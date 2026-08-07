//! Filesystem event debouncing logic.
//!
//! Because operating systems can emit multiple duplicate events for a single user action
//! (e.g. saving a file), this module aggregates events within a 300ms window, deduplicates
//! redundant actions, and only propagates significant changes on relevant files (.yml, .yaml, .env)
//! to the frontend.

use notify::Event;
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::mpsc;

/// Standardized event payload emitted to the frontend for filesystem modifications.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsChangeEventPayload {
    /// The current absolute path of the modified resource.
    pub event_path: String,
    /// The category of change: "create", "modify", "delete", or "rename".
    pub change_type: String,
    /// Whether the target resource is a directory.
    pub is_directory: bool,
    /// The former path of the resource, populated only for "rename" events.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
}

/// Runs the asynchronous debouncing loop.
///
/// Collects notify events from `rx` into a buffer. Once no events have arrived for 300ms,
/// maps, filters, and deduplicates the accumulated events before emitting "fs-change" events
/// via the Tauri IPC channel.
pub async fn start_debounce_loop(mut rx: mpsc::Receiver<Event>, app_handle: tauri::AppHandle) {
    let mut raw_buffer = Vec::new();
    let debounce_duration = Duration::from_millis(300);

    loop {
        tokio::select! {
            some_event = rx.recv() => {
                if let Some(event) = some_event {
                    raw_buffer.push(event);
                } else {
                    break;
                }
            }
            _ = tokio::time::sleep(debounce_duration), if !raw_buffer.is_empty() => {
                let mut payloads = Vec::new();
                for event in raw_buffer.drain(..) {
                    let event_payloads = map_notify_event(event);
                    for p in event_payloads {
                        if should_keep_event(&p) {
                            payloads.push(p);
                        }
                    }
                }

                let deduplicated = deduplicate_events(payloads);

                for payload in deduplicated {
                    tracing::debug!("Filesystem change detected and emitted to frontend: {:?}", payload);
                    let _ = app_handle.emit("fs-change", payload);
                }
            }
        }
    }
}

/// Translates raw notify [`Event`]s into a vector of [`FsChangeEventPayload`]s.
fn map_notify_event(event: Event) -> Vec<FsChangeEventPayload> {
    let is_dir = match event.kind {
        notify::EventKind::Create(notify::event::CreateKind::Folder) => true,
        notify::EventKind::Remove(notify::event::RemoveKind::Folder) => true,
        notify::EventKind::Modify(notify::event::ModifyKind::Name(_)) => {
            event.paths.first().map(|p| p.is_dir()).unwrap_or(false)
        }
        _ => event.paths.first().map(|p| p.is_dir()).unwrap_or(false),
    };

    match event.kind {
        notify::EventKind::Create(_) => event
            .paths
            .into_iter()
            .map(|p| FsChangeEventPayload {
                event_path: p.to_string_lossy().to_string(),
                change_type: "create".to_string(),
                is_directory: is_dir,
                old_path: None,
            })
            .collect(),
        notify::EventKind::Remove(_) => event
            .paths
            .into_iter()
            .map(|p| FsChangeEventPayload {
                event_path: p.to_string_lossy().to_string(),
                change_type: "delete".to_string(),
                is_directory: is_dir,
                old_path: None,
            })
            .collect(),
        notify::EventKind::Modify(notify::event::ModifyKind::Name(_)) => {
            if event.paths.len() >= 2 {
                let old = event.paths[0].to_string_lossy().to_string();
                let new = event.paths[1].to_string_lossy().to_string();
                vec![FsChangeEventPayload {
                    event_path: new,
                    change_type: "rename".to_string(),
                    is_directory: is_dir,
                    old_path: Some(old),
                }]
            } else if event.paths.len() == 1 {
                let path = event.paths[0].to_string_lossy().to_string();
                vec![FsChangeEventPayload {
                    event_path: path,
                    change_type: "modify".to_string(),
                    is_directory: is_dir,
                    old_path: None,
                }]
            } else {
                vec![]
            }
        }
        notify::EventKind::Modify(_) => event
            .paths
            .into_iter()
            .map(|p| FsChangeEventPayload {
                event_path: p.to_string_lossy().to_string(),
                change_type: "modify".to_string(),
                is_directory: is_dir,
                old_path: None,
            })
            .collect(),
        _ => vec![],
    }
}

/// Identifies if a filesystem event should be retained based on its extension or directory status.
fn should_keep_event(payload: &FsChangeEventPayload) -> bool {
    if payload.is_directory {
        return true;
    }
    let path = std::path::Path::new(&payload.event_path);
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        let ext_lower = ext.to_lowercase();
        ext_lower == "yml" || ext_lower == "yaml"
    } else {
        if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
            filename == ".env" || filename.ends_with(".env")
        } else {
            false
        }
    }
}

/// Deduplicates a batch of events according to the following heuristics:
/// - Create + Delete on the same file -> Ignored entirely.
/// - Create + Modify -> Keeps only the Create event.
/// - Multiple Modifies -> Keeps only the most recent Modify event.
fn deduplicate_events(events: Vec<FsChangeEventPayload>) -> Vec<FsChangeEventPayload> {
    let mut map: HashMap<String, FsChangeEventPayload> = HashMap::new();

    for ev in events {
        let path = ev.event_path.clone();
        match ev.change_type.as_str() {
            "create" => {
                if let Some(existing) = map.get_mut(&path) {
                    if existing.change_type == "delete" {
                        existing.change_type = "modify".to_string();
                    }
                } else {
                    map.insert(path, ev);
                }
            }
            "modify" => {
                if let Some(existing) = map.get_mut(&path) {
                    match existing.change_type.as_str() {
                        "create" => {}
                        "delete" => {
                            existing.change_type = "modify".to_string();
                        }
                        _ => {
                            *existing = ev;
                        }
                    }
                } else {
                    map.insert(path, ev);
                }
            }
            "delete" => {
                if let Some(existing) = map.get_mut(&path) {
                    if existing.change_type == "create" {
                        map.remove(&path);
                    } else {
                        existing.change_type = "delete".to_string();
                    }
                } else {
                    map.insert(path, ev);
                }
            }
            "rename" => {
                if let Some(old) = &ev.old_path {
                    if let Some(existing_old) = map.get_mut(old) {
                        if existing_old.change_type == "create" {
                            map.remove(old);
                        } else {
                            existing_old.change_type = "delete".to_string();
                        }
                    } else {
                        map.insert(
                            old.clone(),
                            FsChangeEventPayload {
                                event_path: old.clone(),
                                change_type: "delete".to_string(),
                                is_directory: ev.is_directory,
                                old_path: None,
                            },
                        );
                    }
                }
                let new_path = ev.event_path.clone();
                if let Some(existing_new) = map.get_mut(&new_path) {
                    if existing_new.change_type == "delete" {
                        existing_new.change_type = "modify".to_string();
                    }
                } else {
                    map.insert(new_path, ev);
                }
            }
            _ => {}
        }
    }

    map.into_values().collect()
}

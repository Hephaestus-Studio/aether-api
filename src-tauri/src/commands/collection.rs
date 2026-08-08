use crate::commands::workspace::{get_last_seq_in_dir, sanitize_name, AppState};
use crate::errors::AppError;
use chrono::Utc;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;

/// Response payload returned after creating a new Collection.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCollectionResult {
    /// The unique relative path ID of the collection.
    pub id: String,
    /// Display name of the collection.
    pub name: String,
    /// Absolute filesystem path.
    pub path: String,
    /// Generated sequence index for order sorting.
    pub seq: String,
}

/// Tauri command to construct a new API collection metadata directory.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::DuplicateItem`] if a collection with the same sanitized name already exists.
#[tauri::command]
pub async fn create_collection(
    name: String,
    state: State<'_, AppState>,
) -> Result<CreateCollectionResult, AppError> {
    tracing::info!("Creating collection: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let clean_name = sanitize_name(&name);
    let collection_dir = ws_state.path.join("collections").join(&clean_name);

    if collection_dir.exists() {
        tracing::warn!(
            "Collection '{}' already exists at {}",
            clean_name,
            collection_dir.display()
        );
        return Err(AppError::DuplicateItem(format!(
            "Collection '{}' already exists",
            clean_name
        )));
    }

    std::fs::create_dir_all(&collection_dir)?;

    let collections_root = ws_state.path.join("collections");
    let last_seq = get_last_seq_in_dir(&collections_root);
    let new_seq =
        crate::engine::fractional_index::FractionalIndexer::generate_last(last_seq.as_deref());

    let mut col = crate::models::collection::Collection::new(&name);
    col.seq = Some(new_seq.clone());

    let meta_file = collection_dir.join("collection.yml");
    crate::engine::yaml_parser::atomic_write_yaml(&meta_file, &col)?;

    let id = collection_dir
        .strip_prefix(&ws_state.path)
        .unwrap_or(&collection_dir)
        .to_string_lossy()
        .to_string();

    tracing::info!("Created collection '{}' with ID: {}", name, id);

    Ok(CreateCollectionResult {
        id,
        name,
        path: collection_dir.to_string_lossy().to_string(),
        seq: new_seq,
    })
}

/// Response payload returned after creating a new Folder.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderResult {
    /// The unique relative path ID of the folder.
    pub id: String,
    /// Display name of the folder.
    pub name: String,
    /// Absolute filesystem path.
    pub path: String,
    /// Relative path ID of the parent node.
    pub parent_path: String,
    /// Generated sequence index for order sorting.
    pub seq: String,
}

/// Tauri command to construct a new folder directory in the workspace hierarchy.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::DuplicateItem`] if a folder with the same sanitized name already exists.
#[tauri::command]
pub async fn create_folder(
    parent_path: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<CreateFolderResult, AppError> {
    tracing::info!("Creating folder: '{}' inside '{}'", name, parent_path);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let clean_name = sanitize_name(&name);
    let parent = PathBuf::from(&parent_path);

    let parent_abs = if parent.is_absolute() {
        parent.clone()
    } else {
        ws_state.path.join(&parent)
    };
    let folder_dir = parent_abs.join(&clean_name);

    if folder_dir.exists() {
        tracing::warn!(
            "Folder '{}' already exists at {}",
            clean_name,
            folder_dir.display()
        );
        return Err(AppError::DuplicateItem(format!(
            "Folder '{}' already exists",
            clean_name
        )));
    }

    std::fs::create_dir_all(&folder_dir)?;

    let last_seq = get_last_seq_in_dir(&parent_abs);
    let new_seq =
        crate::engine::fractional_index::FractionalIndexer::generate_last(last_seq.as_deref());

    let mut folder = crate::models::folder::Folder::new(&name);
    folder.seq = Some(new_seq.clone());

    let meta_file = folder_dir.join("folder.yml");
    crate::engine::yaml_parser::atomic_write_yaml(&meta_file, &folder)?;

    let id = folder_dir
        .strip_prefix(&ws_state.path)
        .unwrap_or(&folder_dir)
        .to_string_lossy()
        .to_string();

    tracing::info!("Created folder '{}' with ID: {}", name, id);

    Ok(CreateFolderResult {
        id,
        name,
        path: folder_dir.to_string_lossy().to_string(),
        parent_path,
        seq: new_seq,
    })
}

/// Response payload returned after renaming a resource.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    /// Absolute path of the renamed resource.
    pub new_path: String,
}

/// Tauri command to rename a directory or a configuration file.
///
/// Updates the physical filename/dirname on the disk and updates internal `name` properties.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// [`AppError::ItemNotFound`] if the path is invalid, or [`AppError::DuplicateItem`] if new path collides.
#[tauri::command]
pub async fn rename_item(
    old_path: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<RenameResult, AppError> {
    tracing::info!("Renaming item '{}' to '{}'", old_path, new_name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let old = if Path::new(&old_path).is_absolute() {
        PathBuf::from(&old_path)
    } else {
        ws_state.path.join(&old_path)
    };
    if !old.exists() {
        tracing::error!("Item not found for rename: {}", old_path);
        return Err(AppError::ItemNotFound(old_path));
    }

    let parent = old.parent().ok_or(AppError::InvalidPath)?;
    let clean_name = sanitize_name(&new_name);

    let new = if old.is_file() {
        let ext = old.extension().and_then(|s| s.to_str()).unwrap_or("yml");
        parent.join(format!("{}.{}", clean_name, ext))
    } else {
        parent.join(&clean_name)
    };

    if new.exists() && new != old {
        tracing::warn!("Target path for rename already exists: {}", new.display());
        return Err(AppError::DuplicateItem(format!(
            "Item already exists at new path"
        )));
    }

    std::fs::rename(&old, &new)?;

    if new.is_dir() {
        let col_yml = new.join("collection.yml");
        if col_yml.exists() {
            if let Ok(mut col) = crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::collection::Collection,
            >(&col_yml)
            {
                col.name = new_name.clone();
                col.updated_at = Utc::now();
                let _ = crate::engine::yaml_parser::atomic_write_yaml(&col_yml, &col);
            }
        } else {
            let fold_yml = new.join("folder.yml");
            if fold_yml.exists() {
                if let Ok(mut fold) = crate::engine::yaml_parser::read_and_validate_yaml::<
                    crate::models::folder::Folder,
                >(&fold_yml)
                {
                    fold.name = new_name.clone();
                    fold.updated_at = Utc::now();
                    let _ = crate::engine::yaml_parser::atomic_write_yaml(&fold_yml, &fold);
                }
            }
        }
    } else {
        let entity_type = crate::engine::yaml_parser::peek_entity_type(&new).unwrap_or_default();
        if entity_type == "request" {
            if let Ok(mut req) = crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::request::Request,
            >(&new)
            {
                req.name = new_name.clone();
                req.updated_at = Utc::now();
                let _ = crate::engine::yaml_parser::atomic_write_yaml(&new, &req);
            }
        }
    }

    tracing::info!("Successfully renamed '{}' -> '{}'", old_path, new.display());

    Ok(RenameResult {
        new_path: new.to_string_lossy().to_string(),
    })
}

/// Tauri command to delete a file or directory recursively from the workspace.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if the target path cannot be resolved.
#[tauri::command]
pub async fn delete_item(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    tracing::warn!("Deleting item from workspace: {}", path);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let target = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };
    if !target.exists() {
        tracing::error!("Target path to delete not found: {}", path);
        return Err(AppError::ItemNotFound(path));
    }

    if target.is_dir() {
        std::fs::remove_dir_all(&target)?;
    } else {
        std::fs::remove_file(&target)?;
    }

    tracing::info!("Item successfully deleted: {}", path);

    Ok(())
}

/// Response payload returned after replicating a Request node.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateResult {
    /// Relative path ID of the duplicated resource.
    pub id: String,
    /// Absolute filesystem path.
    pub new_path: String,
}

/// Tauri command to duplicate a request config file, appending copy suffixes to name and filename.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if source item doesn't exist.
#[tauri::command]
pub async fn duplicate_item(
    path: String,
    state: State<'_, AppState>,
) -> Result<DuplicateResult, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let src = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };
    if !src.exists() || src.is_dir() {
        return Err(AppError::ItemNotFound(path));
    }

    let parent = src.parent().ok_or(AppError::InvalidPath)?;
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("request");
    let ext = src.extension().and_then(|s| s.to_str()).unwrap_or("yml");

    let mut counter = 1;
    let mut dest = parent.join(format!("{}_copy.{}", stem, ext));
    while dest.exists() {
        dest = parent.join(format!("{}_copy_{}.{}", stem, counter, ext));
        counter += 1;
    }

    let mut req: crate::models::request::Request =
        crate::engine::yaml_parser::read_and_validate_yaml(&src)?;

    req.name = format!("{} (copy)", req.name);
    let now = Utc::now();
    req.created_at = now;
    req.updated_at = now;

    let new_seq = crate::engine::fractional_index::FractionalIndexer::generate_between(
        req.seq.as_deref(),
        None,
    );
    req.seq = Some(new_seq);

    crate::engine::yaml_parser::atomic_write_yaml(&dest, &req)?;

    let id = dest
        .strip_prefix(&ws_state.path)
        .unwrap_or(&dest)
        .to_string_lossy()
        .to_string();

    Ok(DuplicateResult {
        id,
        new_path: dest.to_string_lossy().to_string(),
    })
}

/// Response payload containing the resolved layout sequence.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderResult {
    /// Newly generated fractional sequence string.
    pub new_seq: String,
}

/// Tauri command to reorder a tree node relative to its surrounding siblings.
///
/// Computes a new sequence index key and persists it to the configuration file.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if target resource cannot be resolved.
#[tauri::command]
pub async fn reorder_item(
    target_path: String,
    prev_seq: Option<String>,
    next_seq: Option<String>,
    state: State<'_, AppState>,
) -> Result<ReorderResult, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let target = if Path::new(&target_path).is_absolute() {
        PathBuf::from(&target_path)
    } else {
        ws_state.path.join(&target_path)
    };
    if !target.exists() {
        return Err(AppError::ItemNotFound(target_path));
    }

    let new_seq = crate::engine::fractional_index::FractionalIndexer::generate_between(
        prev_seq.as_deref(),
        next_seq.as_deref(),
    );

    if target.is_dir() {
        let col_yml = target.join("collection.yml");
        if col_yml.exists() {
            let mut col: crate::models::collection::Collection =
                crate::engine::yaml_parser::read_and_validate_yaml(&col_yml)?;
            col.seq = Some(new_seq.clone());
            col.updated_at = Utc::now();
            crate::engine::yaml_parser::atomic_write_yaml(&col_yml, &col)?;
        } else {
            let fold_yml = target.join("folder.yml");
            if fold_yml.exists() {
                let mut fold: crate::models::folder::Folder =
                    crate::engine::yaml_parser::read_and_validate_yaml(&fold_yml)?;
                fold.seq = Some(new_seq.clone());
                fold.updated_at = Utc::now();
                crate::engine::yaml_parser::atomic_write_yaml(&fold_yml, &fold)?;
            }
        }
    } else {
        let entity_type = crate::engine::yaml_parser::peek_entity_type(&target)?;
        if entity_type == "request" {
            let mut req: crate::models::request::Request =
                crate::engine::yaml_parser::read_and_validate_yaml(&target)?;
            req.seq = Some(new_seq.clone());
            req.updated_at = Utc::now();
            crate::engine::yaml_parser::atomic_write_yaml(&target, &req)?;
        }
    }

    Ok(ReorderResult { new_seq })
}

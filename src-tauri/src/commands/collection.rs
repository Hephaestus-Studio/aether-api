use crate::commands::workspace::{get_last_seq_in_dir, AppState};
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

/// Tauri command to construct a new API collection metadata directory with a UUID v7 directory name.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened.
#[tauri::command]
pub async fn create_collection(
    name: String,
    state: State<'_, AppState>,
) -> Result<CreateCollectionResult, AppError> {
    tracing::info!("Creating collection: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let uuid = uuid::Uuid::now_v7();
    let collection_dir = ws_state.path.join("collections").join(uuid.to_string());

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

/// Tauri command to construct a new folder directory with a UUID v7 directory name.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::InvalidPath`] if the parent path cannot be resolved.
#[tauri::command]
pub async fn create_folder(
    parent_path: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<CreateFolderResult, AppError> {
    tracing::info!("Creating folder: '{}' inside '{}'", name, parent_path);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let uuid = uuid::Uuid::now_v7();
    let parent = PathBuf::from(&parent_path);

    let parent_abs = if parent.is_absolute() {
        parent.clone()
    } else {
        ws_state.path.join(&parent)
    };
    let folder_dir = parent_abs.join(uuid.to_string());

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

/// Tauri command to rename a directory (collection/folder) or a request file.
///
/// All items use immutable UUID v7 names on disk. Renaming simply updates
/// the `name` field inside the corresponding YAML file in place.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if the path is invalid.
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

    if old.is_file() {
        // Request files use UUID v7 filenames — update the `name` field in YAML
        let entity_type = crate::engine::yaml_parser::peek_entity_type(&old).unwrap_or_default();
        if entity_type == "request" {
            if let Ok(mut req) = crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::request::Request,
            >(&old)
            {
                req.name = new_name.clone();
                req.updated_at = Utc::now();
                crate::engine::yaml_parser::atomic_write_yaml(&old, &req)?;
            }
        }
        tracing::info!("Updated request name of '{}' to '{}'", old_path, new_name);
        return Ok(RenameResult {
            new_path: old.to_string_lossy().to_string(),
        });
    }

    // Collections & Folders use UUID v7 directory names — update `name` in collection.yml / folder.yml
    let col_yml = old.join("collection.yml");
    let col_yaml = old.join("collection.yaml");
    let fold_yml = old.join("folder.yml");
    let fold_yaml = old.join("folder.yaml");

    if col_yml.exists() || col_yaml.exists() {
        let meta_file = if col_yml.exists() { col_yml } else { col_yaml };
        if let Ok(mut col) = crate::engine::yaml_parser::read_and_validate_yaml::<
            crate::models::collection::Collection,
        >(&meta_file)
        {
            col.name = new_name.clone();
            col.updated_at = Utc::now();
            let _ = crate::engine::yaml_parser::atomic_write_yaml(&meta_file, &col);
        }
    } else if fold_yml.exists() || fold_yaml.exists() {
        let meta_file = if fold_yml.exists() {
            fold_yml
        } else {
            fold_yaml
        };
        if let Ok(mut fold) = crate::engine::yaml_parser::read_and_validate_yaml::<
            crate::models::folder::Folder,
        >(&meta_file)
        {
            fold.name = new_name.clone();
            fold.updated_at = Utc::now();
            let _ = crate::engine::yaml_parser::atomic_write_yaml(&meta_file, &fold);
        }
    }

    tracing::info!(
        "Updated directory metadata name of '{}' to '{}'",
        old_path,
        new_name
    );

    Ok(RenameResult {
        new_path: old.to_string_lossy().to_string(),
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

    // Use UUID v7 for the duplicate filename to ensure uniqueness
    let uuid = uuid::Uuid::now_v7();
    let dest = parent.join(format!("{}.yml", uuid));

    let mut req: crate::models::request::Request =
        crate::engine::yaml_parser::read_and_validate_yaml(&src)?;

    req.name = format!("{} (Copy)", req.name);
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

/// Response payload returned after moving or reordering an item.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveItemResult {
    /// Absolute filesystem path of the moved item.
    pub new_path: String,
    /// Relative path ID of the moved item.
    pub new_id: String,
    /// Resolved sequence string.
    pub new_seq: String,
}

/// Tauri command to move an item to a new parent directory and/or reorder it.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// [`AppError::ItemNotFound`] if source item doesn't exist,
/// or [`AppError::InvalidPath`] if target directory is invalid.
#[tauri::command]
pub async fn move_item(
    source_path: String,
    target_parent_path: String,
    prev_seq: Option<String>,
    next_seq: Option<String>,
    state: State<'_, AppState>,
) -> Result<MoveItemResult, AppError> {
    tracing::info!(
        "Moving item '{}' to parent '{}' (prev_seq: {:?}, next_seq: {:?})",
        source_path,
        target_parent_path,
        prev_seq,
        next_seq
    );
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let src = if Path::new(&source_path).is_absolute() {
        PathBuf::from(&source_path)
    } else {
        ws_state.path.join(&source_path)
    };
    if !src.exists() {
        return Err(AppError::ItemNotFound(source_path));
    }

    let target_parent = if Path::new(&target_parent_path).is_absolute() {
        PathBuf::from(&target_parent_path)
    } else {
        ws_state.path.join(&target_parent_path)
    };
    if !target_parent.exists() || !target_parent.is_dir() {
        return Err(AppError::InvalidPath);
    }

    // Prevent moving a directory into itself or its descendants
    if src.is_dir() && (target_parent == src || target_parent.starts_with(&src)) {
        return Err(AppError::InvalidPath);
    }

    let file_name = src.file_name().ok_or(AppError::InvalidPath)?;
    let dest = target_parent.join(file_name);

    let new_seq = crate::engine::fractional_index::FractionalIndexer::generate_between(
        prev_seq.as_deref(),
        next_seq.as_deref(),
    );

    if src != dest {
        if dest.exists() {
            return Err(AppError::DuplicateItem(
                "An item with the same name already exists in the target folder".to_string(),
            ));
        }
        std::fs::rename(&src, &dest)?;
    }

    if dest.is_dir() {
        let col_yml = dest.join("collection.yml");
        if col_yml.exists() {
            if let Ok(mut col) = crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::collection::Collection,
            >(&col_yml)
            {
                col.seq = Some(new_seq.clone());
                col.updated_at = Utc::now();
                let _ = crate::engine::yaml_parser::atomic_write_yaml(&col_yml, &col);
            }
        } else {
            let fold_yml = dest.join("folder.yml");
            if fold_yml.exists() {
                if let Ok(mut fold) = crate::engine::yaml_parser::read_and_validate_yaml::<
                    crate::models::folder::Folder,
                >(&fold_yml)
                {
                    fold.seq = Some(new_seq.clone());
                    fold.updated_at = Utc::now();
                    let _ = crate::engine::yaml_parser::atomic_write_yaml(&fold_yml, &fold);
                }
            }
        }
    } else {
        let entity_type = crate::engine::yaml_parser::peek_entity_type(&dest).unwrap_or_default();
        if entity_type == "request" {
            if let Ok(mut req) = crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::request::Request,
            >(&dest)
            {
                req.seq = Some(new_seq.clone());
                req.updated_at = Utc::now();
                let _ = crate::engine::yaml_parser::atomic_write_yaml(&dest, &req);
            }
        }
    }

    let new_id = dest
        .strip_prefix(&ws_state.path)
        .unwrap_or(&dest)
        .to_string_lossy()
        .to_string();

    Ok(MoveItemResult {
        new_path: dest.to_string_lossy().to_string(),
        new_id,
        new_seq,
    })
}

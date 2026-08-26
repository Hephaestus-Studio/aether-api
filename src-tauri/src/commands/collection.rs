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

/// Response payload returned after replicating a Request, Folder, or Collection node.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateResult {
    /// Relative path ID of the duplicated resource.
    pub id: String,
    /// Absolute filesystem path.
    pub new_path: String,
    /// Name of the duplicated resource.
    pub name: String,
    /// HTTP method of the duplicated request (if node is request).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    /// Node type of the duplicated item: "request" | "folder" | "collection".
    pub node_type: String,
}

/// Recursively clones children of a collection or folder directory, generating fresh UUID v7
/// filenames and directory names, updating timestamps while preserving names and internal relative sequence ordering.
fn duplicate_directory_children(src: &Path, dest: &Path) -> Result<(), AppError> {
    if !src.is_dir() {
        return Ok(());
    }

    let entries = std::fs::read_dir(src)?;
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Skip parent metadata files as they have already been customized and written to dest
        if file_name == "collection.yml"
            || file_name == "collection.yaml"
            || file_name == "folder.yml"
            || file_name == "folder.yaml"
        {
            continue;
        }

        if path.is_file() {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "yml" || ext == "yaml" {
                if let Ok(mut req) = crate::engine::yaml_parser::read_and_validate_yaml::<
                    crate::models::request::Request,
                >(&path)
                {
                    let now = Utc::now();
                    req.created_at = now;
                    req.updated_at = now;
                    let new_uuid = uuid::Uuid::now_v7();
                    let dest_file = dest.join(format!("{}.yml", new_uuid));
                    crate::engine::yaml_parser::atomic_write_yaml(&dest_file, &req)?;
                    continue;
                }
            }
            let dest_file = dest.join(file_name);
            let _ = std::fs::copy(&path, &dest_file);
        } else if path.is_dir() {
            let fold_yml = path.join("folder.yml");
            let fold_yaml = path.join("folder.yaml");
            let meta_file = if fold_yml.exists() {
                Some(fold_yml)
            } else if fold_yaml.exists() {
                Some(fold_yaml)
            } else {
                None
            };

            let new_subfolder_uuid = uuid::Uuid::now_v7();
            let dest_subfolder = dest.join(new_subfolder_uuid.to_string());
            std::fs::create_dir_all(&dest_subfolder)?;

            if let Some(meta) = meta_file {
                if let Ok(mut fold) = crate::engine::yaml_parser::read_and_validate_yaml::<
                    crate::models::folder::Folder,
                >(&meta)
                {
                    let now = Utc::now();
                    fold.created_at = now;
                    fold.updated_at = now;
                    let dest_meta = dest_subfolder.join("folder.yml");
                    let _ = crate::engine::yaml_parser::atomic_write_yaml(&dest_meta, &fold);
                }
            }

            duplicate_directory_children(&path, &dest_subfolder)?;
        }
    }

    Ok(())
}

/// Tauri command to duplicate a request config file, folder, or collection, appending copy suffixes to name.
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
    if !src.exists() {
        return Err(AppError::ItemNotFound(path));
    }

    let parent = src.parent().ok_or(AppError::InvalidPath)?;

    if src.is_file() {
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

        let method = req.method.to_string();
        let name = req.name.clone();

        crate::engine::yaml_parser::atomic_write_yaml(&dest, &req)?;

        let id = dest
            .strip_prefix(&ws_state.path)
            .unwrap_or(&dest)
            .to_string_lossy()
            .to_string();

        return Ok(DuplicateResult {
            id,
            new_path: dest.to_string_lossy().to_string(),
            name,
            method: Some(method),
            node_type: "request".to_string(),
        });
    }

    // src is a directory: Collection or Folder
    let col_yml = src.join("collection.yml");
    let col_yaml = src.join("collection.yaml");
    let fold_yml = src.join("folder.yml");
    let fold_yaml = src.join("folder.yaml");

    let is_collection = col_yml.exists() || col_yaml.exists();
    let is_folder = fold_yml.exists() || fold_yaml.exists();

    if !is_collection && !is_folder {
        return Err(AppError::ItemNotFound(path));
    }

    let uuid = uuid::Uuid::now_v7();
    let dest = parent.join(uuid.to_string());
    std::fs::create_dir_all(&dest)?;

    if is_collection {
        let meta_file = if col_yml.exists() { col_yml } else { col_yaml };
        let mut col: crate::models::collection::Collection =
            crate::engine::yaml_parser::read_and_validate_yaml(&meta_file)?;

        col.name = format!("{} (Copy)", col.name);
        let now = Utc::now();
        col.created_at = now;
        col.updated_at = now;

        let new_seq = crate::engine::fractional_index::FractionalIndexer::generate_between(
            col.seq.as_deref(),
            None,
        );
        col.seq = Some(new_seq);

        let name = col.name.clone();
        let dest_meta = dest.join("collection.yml");
        crate::engine::yaml_parser::atomic_write_yaml(&dest_meta, &col)?;

        duplicate_directory_children(&src, &dest)?;

        let id = dest
            .strip_prefix(&ws_state.path)
            .unwrap_or(&dest)
            .to_string_lossy()
            .to_string();

        Ok(DuplicateResult {
            id,
            new_path: dest.to_string_lossy().to_string(),
            name,
            method: None,
            node_type: "collection".to_string(),
        })
    } else {
        let meta_file = if fold_yml.exists() { fold_yml } else { fold_yaml };
        let mut fold: crate::models::folder::Folder =
            crate::engine::yaml_parser::read_and_validate_yaml(&meta_file)?;

        fold.name = format!("{} (Copy)", fold.name);
        let now = Utc::now();
        fold.created_at = now;
        fold.updated_at = now;

        let new_seq = crate::engine::fractional_index::FractionalIndexer::generate_between(
            fold.seq.as_deref(),
            None,
        );
        fold.seq = Some(new_seq);

        let name = fold.name.clone();
        let dest_meta = dest.join("folder.yml");
        crate::engine::yaml_parser::atomic_write_yaml(&dest_meta, &fold)?;

        duplicate_directory_children(&src, &dest)?;

        let id = dest
            .strip_prefix(&ws_state.path)
            .unwrap_or(&dest)
            .to_string_lossy()
            .to_string();

        Ok(DuplicateResult {
            id,
            new_path: dest.to_string_lossy().to_string(),
            name,
            method: None,
            node_type: "folder".to_string(),
        })
    }
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

/// Tauri command to read a collection configuration file (collection.yml) from disk.
#[tauri::command]
pub async fn read_collection(
    path: String,
    state: State<'_, AppState>,
) -> Result<crate::models::collection::Collection, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let target = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };

    let col_file = if target.is_dir() {
        let yml = target.join("collection.yml");
        let yaml = target.join("collection.yaml");
        if yml.exists() {
            yml
        } else {
            yaml
        }
    } else {
        target
    };

    if !col_file.exists() {
        return Err(AppError::ItemNotFound(path));
    }

    let col = crate::engine::yaml_parser::read_and_validate_yaml(&col_file)?;
    Ok(col)
}

/// Tauri command to update and write a collection configuration file (collection.yml) to disk.
#[tauri::command]
pub async fn update_collection(
    path: String,
    collection: crate::models::collection::Collection,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let target = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };

    let col_file = if target.is_dir() {
        let yml = target.join("collection.yml");
        let yaml = target.join("collection.yaml");
        if yaml.exists() {
            yaml
        } else {
            yml
        }
    } else {
        target
    };

    let mut col_to_save = collection;
    col_to_save.updated_at = Utc::now();

    crate::engine::yaml_parser::atomic_write_yaml(&col_file, &col_to_save)?;
    Ok(())
}

/// Tauri command to read a folder configuration file (folder.yml) from disk.
#[tauri::command]
pub async fn read_folder(
    path: String,
    state: State<'_, AppState>,
) -> Result<crate::models::folder::Folder, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let target = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };

    let fold_file = if target.is_dir() {
        let yml = target.join("folder.yml");
        let yaml = target.join("folder.yaml");
        if yml.exists() {
            yml
        } else {
            yaml
        }
    } else {
        target
    };

    if !fold_file.exists() {
        return Err(AppError::ItemNotFound(path));
    }

    let fold = crate::engine::yaml_parser::read_and_validate_yaml(&fold_file)?;
    Ok(fold)
}

/// Tauri command to update and write a folder configuration file (folder.yml) to disk.
#[tauri::command]
pub async fn update_folder(
    path: String,
    folder: crate::models::folder::Folder,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let target = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };

    let fold_file = if target.is_dir() {
        let yml = target.join("folder.yml");
        let yaml = target.join("folder.yaml");
        if yaml.exists() {
            yaml
        } else {
            yml
        }
    } else {
        target
    };

    let mut fold_to_save = folder;
    fold_to_save.updated_at = Utc::now();

    crate::engine::yaml_parser::atomic_write_yaml(&fold_file, &fold_to_save)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::collection::Collection;
    use crate::models::folder::Folder;
    use crate::models::request::{HttpMethod, Request};
    use tempfile::tempdir;

    #[test]
    fn test_duplicate_directory_children_deep() {
        let temp = tempdir().unwrap();
        let src_col = temp.path().join("collections").join("col_1");
        std::fs::create_dir_all(&src_col).unwrap();

        // 1. Create collection.yml
        let mut col = Collection::new("Users API");
        col.seq = Some("a0".to_string());
        crate::engine::yaml_parser::atomic_write_yaml(&src_col.join("collection.yml"), &col)
            .unwrap();

        // 2. Create a root request
        let mut req1 = Request::new("Get All Users");
        req1.method = HttpMethod::Get;
        req1.url = "https://api.example.com/users".to_string();
        req1.seq = Some("a0".to_string());
        crate::engine::yaml_parser::atomic_write_yaml(&src_col.join("req1.yml"), &req1).unwrap();

        // 3. Create a subfolder with folder.yml and a nested request
        let subfolder = src_col.join("subfolder_1");
        std::fs::create_dir_all(&subfolder).unwrap();

        let mut fold = Folder::new("Auth");
        fold.seq = Some("a1".to_string());
        crate::engine::yaml_parser::atomic_write_yaml(&subfolder.join("folder.yml"), &fold).unwrap();

        let mut req2 = Request::new("Login");
        req2.method = HttpMethod::Post;
        req2.url = "https://api.example.com/login".to_string();
        req2.seq = Some("a0".to_string());
        crate::engine::yaml_parser::atomic_write_yaml(&subfolder.join("req2.yml"), &req2).unwrap();

        // 4. Duplicate into dest
        let dest_col = temp.path().join("collections").join("col_2");
        std::fs::create_dir_all(&dest_col).unwrap();

        // Write dest collection.yml with (Copy)
        let mut col_copy = col.clone();
        col_copy.name = format!("{} (Copy)", col.name);
        crate::engine::yaml_parser::atomic_write_yaml(&dest_col.join("collection.yml"), &col_copy)
            .unwrap();

        // Run recursive duplication
        duplicate_directory_children(&src_col, &dest_col).unwrap();

        // Validate dest
        assert!(dest_col.join("collection.yml").exists());
        let read_col: Collection =
            crate::engine::yaml_parser::read_and_validate_yaml(&dest_col.join("collection.yml"))
                .unwrap();
        assert_eq!(read_col.name, "Users API (Copy)");

        // Check duplicated root request
        let dest_entries: Vec<_> = std::fs::read_dir(&dest_col)
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .collect();
        let req_files: Vec<_> = dest_entries
            .iter()
            .filter(|p| p.is_file() && p.file_name().unwrap() != "collection.yml")
            .collect();
        assert_eq!(req_files.len(), 1);

        let read_req: Request =
            crate::engine::yaml_parser::read_and_validate_yaml(req_files[0]).unwrap();
        assert_eq!(read_req.name, "Get All Users");
        assert_eq!(read_req.method, HttpMethod::Get);

        // Check duplicated subfolder
        let subfolders: Vec<_> = dest_entries.iter().filter(|p| p.is_dir()).collect();
        assert_eq!(subfolders.len(), 1);
        let dest_subfolder = subfolders[0];
        assert!(dest_subfolder.join("folder.yml").exists());

        let read_fold: Folder = crate::engine::yaml_parser::read_and_validate_yaml(
            &dest_subfolder.join("folder.yml"),
        )
        .unwrap();
        assert_eq!(read_fold.name, "Auth");

        let inner_reqs: Vec<_> = std::fs::read_dir(dest_subfolder)
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_file() && p.file_name().unwrap() != "folder.yml")
            .collect();
        assert_eq!(inner_reqs.len(), 1);

        let read_inner_req: Request =
            crate::engine::yaml_parser::read_and_validate_yaml(&inner_reqs[0]).unwrap();
        assert_eq!(read_inner_req.name, "Login");
        assert_eq!(read_inner_req.method, HttpMethod::Post);
    }
}


use crate::engine::yaml_parser;
use crate::errors::AppError;
use serde::Serialize;
use std::path::Path;

const MAX_SCAN_DEPTH: usize = 10;

const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    ".DS_Store",
    "target",
    ".idea",
    ".vscode",
];

/// Represents the type of a scanned file system node within the workspace.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NodeType {
    /// A collection grouping multiple API folders and requests.
    Collection,
    /// A subdirectory folder grouping related API requests.
    Folder,
    /// A single API HTTP request file.
    Request,
    /// An environment variables configuration file.
    Environment,
    /// A general configuration or settings file.
    Config,
}

/// Represents a node within the hierarchical tree structure of the workspace.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTreeNode {
    /// The unique relative path ID of the node.
    pub id: String,
    /// Display name of the node.
    pub name: String,
    /// Absolute filesystem path.
    pub path: String,
    /// The specific type of the node.
    pub node_type: NodeType,
    /// Optional sequence key for ordering.
    pub seq: Option<String>,
    /// Optional HTTP method for request nodes.
    pub method: Option<String>,
    /// Optional protocol (e.g. "websocket", "http").
    pub protocol: Option<String>,
    /// Child nodes contained within this directory node.
    pub children: Vec<WorkspaceTreeNode>,
}


/// The root representation of a scanned workspace.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTree {
    /// Absolute path to the root workspace directory.
    pub root_path: String,
    /// The user-facing name of the workspace.
    pub name: String,
    /// The root-level directory and file nodes of the workspace.
    pub children: Vec<WorkspaceTreeNode>,
}

/// A directory scanner that traverses the filesystem to build a hierarchical tree structure.
pub struct FsScanner;

impl FsScanner {
    /// Scans the specified workspace directory path and builds its hierarchical tree representation.
    ///
    /// # Errors
    /// Returns [`AppError::InvalidPath`] if the path does not exist or is not a directory.
    pub fn scan(workspace_path: &Path) -> Result<WorkspaceTree, AppError> {
        if !workspace_path.exists() || !workspace_path.is_dir() {
            return Err(AppError::InvalidPath);
        }

        let workspace_name = workspace_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Workspace")
            .to_string();

        let children = Self::scan_directory(workspace_path, workspace_path)?;

        Ok(WorkspaceTree {
            root_path: workspace_path.to_string_lossy().to_string(),
            name: workspace_name,
            children,
        })
    }

    /// Recursively scans a directory to extract and format its contents.
    fn scan_directory(
        dir_path: &Path,
        workspace_root: &Path,
    ) -> Result<Vec<WorkspaceTreeNode>, AppError> {
        let mut nodes: Vec<WorkspaceTreeNode> = Vec::new();

        let entries = std::fs::read_dir(dir_path).map_err(|e| {
            AppError::FsError(format!(
                "Cannot read directory '{}': {}",
                dir_path.display(),
                e
            ))
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| AppError::FsError(e.to_string()))?;
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if Self::should_ignore(&file_name) {
                continue;
            }

            let rel_path = path
                .strip_prefix(workspace_root)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            if path.is_dir() {
                let node =
                    Self::build_directory_node(&path, workspace_root, &rel_path, &file_name)?;
                nodes.push(node);
            } else if Self::is_yaml_file(&file_name) {
                if let Ok(node) = Self::build_file_node(&path, &rel_path, &file_name) {
                    nodes.push(node);
                }
            }
        }

        Self::sort_nodes(&mut nodes);

        Ok(nodes)
    }

    /// Inspects and builds a workspace node representation for a directory (Folder or Collection).
    fn build_directory_node(
        dir_path: &Path,
        workspace_root: &Path,
        rel_path: &str,
        dir_name: &str,
    ) -> Result<WorkspaceTreeNode, AppError> {
        let collection_yml = dir_path.join("collection.yml");
        let collection_yaml = dir_path.join("collection.yaml");
        let folder_yml = dir_path.join("folder.yml");
        let folder_yaml = dir_path.join("folder.yaml");

        let (node_type, name, seq) = if collection_yml.exists() || collection_yaml.exists() {
            let meta_path = if collection_yml.exists() {
                collection_yml
            } else {
                collection_yaml
            };
            let (name, seq, _, _) = yaml_parser::peek_metadata(&meta_path)
                .unwrap_or_else(|_| (dir_name.to_string(), None, None, None));
            (NodeType::Collection, name, seq)
        } else if folder_yml.exists() || folder_yaml.exists() {
            let meta_path = if folder_yml.exists() {
                folder_yml
            } else {
                folder_yaml
            };
            let (name, seq, _, _) = yaml_parser::peek_metadata(&meta_path)
                .unwrap_or_else(|_| (dir_name.to_string(), None, None, None));
            (NodeType::Folder, name, seq)
        } else {
            (NodeType::Folder, dir_name.to_string(), None)
        };

        let depth = rel_path.matches('/').count() + rel_path.matches('\\').count();
        let children = if depth < MAX_SCAN_DEPTH {
            Self::scan_directory(dir_path, workspace_root)?
        } else {
            Vec::new()
        };

        Ok(WorkspaceTreeNode {
            id: rel_path.to_string(),
            name,
            path: dir_path.to_string_lossy().to_string(),
            node_type,
            seq,
            method: None,
            protocol: None,
            children,
        })
    }

    /// Inspects and builds a workspace node representation for an API configuration or Request file.
    fn build_file_node(
        file_path: &Path,
        rel_path: &str,
        file_name: &str,
    ) -> Result<WorkspaceTreeNode, AppError> {
        let lower_name = file_name.to_lowercase();
        if lower_name == "collection.yml"
            || lower_name == "collection.yaml"
            || lower_name == "folder.yml"
            || lower_name == "folder.yaml"
        {
            return Err(AppError::InvalidPath);
        }

        let entity_type = yaml_parser::peek_entity_type(file_path).unwrap_or_default();
        let (name, seq, mut method, protocol) = yaml_parser::peek_metadata(file_path).unwrap_or_else(|_| {
            (
                file_name
                    .trim_end_matches(".yml")
                    .trim_end_matches(".yaml")
                    .to_string(),
                None,
                None,
                None,
            )
        });

        if protocol.as_deref() == Some("websocket") {
            method = Some("WS".to_string());
        }

        let node_type = match entity_type.as_str() {
            "request" => NodeType::Request,
            "environment" => NodeType::Environment,
            "workspace" => NodeType::Config,
            _ => NodeType::Config,
        };

        Ok(WorkspaceTreeNode {
            id: rel_path.to_string(),
            name,
            path: file_path.to_string_lossy().to_string(),
            node_type,
            seq,
            method,
            protocol,
            children: Vec::new(),
        })
    }


    /// Checks if a file or directory name should be ignored during workspace traversal.
    fn should_ignore(name: &str) -> bool {
        if IGNORED_DIRS.contains(&name) {
            return true;
        }
        if name.starts_with('.') && name != ".env" {
            return true;
        }
        false
    }

    /// Helper to identify if a filename belongs to a YAML config file.
    fn is_yaml_file(name: &str) -> bool {
        let lower = name.to_lowercase();
        lower.ends_with(".yml") || lower.ends_with(".yaml")
    }

    /// Sorts a mutable slice of workspace nodes.
    ///
    /// Sorting hierarchy:
    /// 1. Directories (Collections & Folders) always go first.
    /// 2. Sorting based on fractional index `seq` identifier.
    /// 3. Alphabetical fallback by case-insensitive name.
    fn sort_nodes(nodes: &mut [WorkspaceTreeNode]) {
        nodes.sort_by(|a, b| {
            let a_is_dir = matches!(a.node_type, NodeType::Collection | NodeType::Folder);
            let b_is_dir = matches!(b.node_type, NodeType::Collection | NodeType::Folder);

            match (a_is_dir, b_is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => match (&a.seq, &b.seq) {
                    (Some(sa), Some(sb)) => sa.cmp(sb),
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                },
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_should_ignore() {
        assert!(FsScanner::should_ignore(".git"));
        assert!(FsScanner::should_ignore("node_modules"));
        assert!(FsScanner::should_ignore(".DS_Store"));
        assert!(FsScanner::should_ignore(".hidden_folder"));
        assert!(!FsScanner::should_ignore(".env"));
        assert!(!FsScanner::should_ignore("collections"));
        assert!(!FsScanner::should_ignore("my_request.yml"));
    }

    #[test]
    fn test_is_yaml_file() {
        assert!(FsScanner::is_yaml_file("request.yml"));
        assert!(FsScanner::is_yaml_file("config.YAML"));
        assert!(FsScanner::is_yaml_file("data.yaml"));
        assert!(!FsScanner::is_yaml_file("readme.md"));
        assert!(!FsScanner::is_yaml_file("script.rs"));
    }

    #[test]
    fn test_sort_nodes_folders_before_files() {
        let mut nodes = vec![
            WorkspaceTreeNode {
                id: "req1".into(),
                name: "Request A".into(),
                path: "/req1".into(),
                node_type: NodeType::Request,
                seq: None,
                method: Some("GET".into()),
                protocol: None,
                children: vec![],
            },
            WorkspaceTreeNode {
                id: "col1".into(),
                name: "Collection B".into(),
                path: "/col1".into(),
                node_type: NodeType::Collection,
                seq: None,
                method: None,
                protocol: None,
                children: vec![],
            },
        ];
        FsScanner::sort_nodes(&mut nodes);
        assert_eq!(nodes[0].node_type, NodeType::Collection);
        assert_eq!(nodes[1].node_type, NodeType::Request);
    }

    #[test]
    fn test_scan_empty_directory() {
        let dir = tempdir().unwrap();
        let result = FsScanner::scan(dir.path());
        assert!(result.is_ok());
        assert!(result.unwrap().children.is_empty());
    }
}

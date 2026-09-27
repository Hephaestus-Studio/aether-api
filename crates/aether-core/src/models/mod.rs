//! Core data models for the Aether API application.
//!
//! This module defines the schemas and structures used to represent collections,
//! environments, folders, requests, responses, and workspace settings.
//! All data structures are serializable for persistence (e.g. YAML files)
//! and for Inter-Process Communication (IPC) within the Tauri app.

pub mod app_config;
pub mod collection;
pub mod environment;
pub mod folder;
pub mod key_value;
pub mod recent_workspace;
pub mod request;
pub mod response;
pub mod workspace;
pub mod workspace_session;

pub use app_config::AppConfig;
pub use key_value::KeyValue;

pub use recent_workspace::{RecentWorkspace, RecentWorkspacesList};
pub use workspace_session::WorkspaceSession;

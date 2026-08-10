//! Tauri command handlers exposed to the frontend.
//!
//! Submodules include:
//! - [`workspace`]: Managing active workspaces, workspace layout, and git integrations.
//! - [`collection`]: Creating, removing, reordering, and renaming collection folder nodes.
//! - [`request`]: Executing, modifying, and cancelling API HTTP requests.
//! - [`environment`]: Environment variable configuration management.

pub mod collection;
pub mod environment;
pub mod request;
pub mod terminal;
pub mod workspace;

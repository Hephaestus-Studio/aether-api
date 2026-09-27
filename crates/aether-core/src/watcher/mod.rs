//! File system watcher subsystem.
//!
//! Provides recursive monitoring of the workspace directory using the `notify` library,
//! dispatching file system events through a multi-producer single-consumer channel for debouncing.

pub mod debounce;

use crate::errors::AppError;
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use tokio::sync::mpsc;

/// A file system event watcher that recursively monitors a directory.
pub struct FsWatcher {
    _watcher: RecommendedWatcher,
}

impl FsWatcher {
    /// Initializes and starts a new recursive filesystem watcher for the target workspace.
    ///
    /// Transmits raw system events down the provided channel sender `tx` for downstream processing.
    ///
    /// # Errors
    /// Returns [`AppError::FsError`] if the recommended watcher setup fails or cannot watch the path.
    pub fn new(workspace_path: PathBuf, tx: mpsc::Sender<Event>) -> Result<Self, AppError> {
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.blocking_send(event);
            }
        })
        .map_err(|e| AppError::FsError(e.to_string()))?;

        watcher
            .watch(&workspace_path, RecursiveMode::Recursive)
            .map_err(|e| AppError::FsError(e.to_string()))?;

        Ok(Self { _watcher: watcher })
    }
}

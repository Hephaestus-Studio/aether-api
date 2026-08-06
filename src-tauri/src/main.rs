// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Main entry point for the Aether API backend application.
//!
//! Sets up the Tauri builder, registers commands, initializes logging systems,
//! and bootstraps the application runner context.

use tauri::Manager;

mod commands;
mod errors;
mod models;

/// A simple greeting command to verify Inter-Process Communication (IPC) connectivity
/// between the frontend and the Tauri backend.
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// The main runner function of the Tauri application.
///
/// Configures the default Tauri builder setup, hooks up logging handlers,
/// registers backend command handlers, and starts the main application loop.
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            let log_dir = app.path().app_log_dir().unwrap();
            let file_appender = tracing_appender::rolling::daily(log_dir, "aether.log");
            tracing_subscriber::fmt()
                .with_writer(file_appender)
                .with_env_filter("info")
                .init();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running application");
}

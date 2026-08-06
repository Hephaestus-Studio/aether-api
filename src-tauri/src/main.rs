// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Main entry point for the Aether API backend application.
//!
//! Sets up the Tauri builder, registers commands, initializes logging systems,
//! and bootstraps the application runner context.

use tauri::Manager;

mod commands;
mod engine;
mod errors;
mod models;
mod watcher;

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
    let http_executor = engine::http_client::HttpExecutor::new();
    let app_state = commands::workspace::AppState::new(http_executor);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::workspace::open_workspace,
            commands::workspace::close_workspace,
            commands::workspace::get_workspace_info,
            commands::workspace::save_workspace_state,
            commands::workspace::get_git_status,
            commands::workspace::get_git_diff,
            commands::collection::create_collection,
            commands::collection::create_folder,
            commands::collection::rename_item,
            commands::collection::delete_item,
            commands::collection::duplicate_item,
            commands::collection::reorder_item,
            commands::request::read_request,
            commands::request::update_request,
            commands::request::execute_request,
            commands::request::cancel_request,
            commands::environment::list_environments,
            commands::environment::read_environment,
            commands::environment::create_environment,
            commands::environment::update_environment,
            commands::environment::delete_environment,
        ])
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

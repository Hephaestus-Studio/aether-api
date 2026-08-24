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
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::workspace::open_workspace,
            commands::workspace::close_workspace,
            commands::workspace::get_workspace_info,
            commands::workspace::save_workspace_state,
            commands::workspace::get_git_status,
            commands::workspace::get_git_diff,
            commands::workspace::create_workspace,
            commands::workspace::get_app_config,
            commands::workspace::update_app_config,
            commands::terminal::create_terminal_session,
            commands::terminal::get_terminal_buffer,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::terminal::close_all_terminals,
            commands::collection::create_collection,
            commands::collection::create_folder,
            commands::collection::read_collection,
            commands::collection::update_collection,
            commands::collection::read_folder,
            commands::collection::update_folder,
            commands::collection::rename_item,
            commands::collection::delete_item,
            commands::collection::duplicate_item,
            commands::collection::reorder_item,
            commands::collection::move_item,
            commands::request::read_request,
            commands::request::create_request,
            commands::request::update_request,
            commands::request::execute_request,
            commands::request::cancel_request,
            commands::request::save_response_to_file,
            commands::request::resolve_inherited_context,
            commands::environment::list_environments,
            commands::environment::read_environment,
            commands::environment::create_environment,
            commands::environment::update_environment,
            commands::environment::rename_environment,
            commands::environment::delete_environment,
            commands::environment::get_master_key_status,
            commands::environment::set_master_key,
            commands::environment::generate_master_key,
            commands::environment::remove_master_key,
            commands::environment::cleanup_legacy_dotenv_files,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let label = window.label();
                if label == "main" {
                    window.app_handle().exit(0);
                } else if label == "welcome" {
                    let app = window.app_handle();
                    if let Some(main_window) = app.get_webview_window("main") {
                        if !main_window.is_visible().unwrap_or(false) {
                            app.exit(0);
                        }
                    } else {
                        app.exit(0);
                    }
                }
            }
        })
        .setup(|app| {
            use tracing_subscriber::layer::SubscriberExt;
            use tracing_subscriber::util::SubscriberInitExt;
            use tracing_subscriber::EnvFilter;

            let log_dir = app.path().app_log_dir().unwrap();
            let file_appender = tracing_appender::rolling::daily(log_dir, "aether.log");

            let env_filter =
                EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

            let stdout_layer = tracing_subscriber::fmt::layer().with_writer(std::io::stdout);
            let file_layer = tracing_subscriber::fmt::layer().with_writer(file_appender);

            tracing_subscriber::registry()
                .with(env_filter)
                .with(stdout_layer)
                .with(file_layer)
                .init();

            tracing::info!("Aether API backend initialized");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running application");
}

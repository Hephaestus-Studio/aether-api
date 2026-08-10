use crate::commands::workspace::AppState;
use crate::errors::AppError;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

/// Represents an active Pseudo-Terminal session.
#[allow(dead_code)]
pub struct TerminalSession {
    pub id: String,
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub buffer: Arc<Mutex<Vec<u8>>>,
}

/// Thread-safe manager holding active PTY terminal sessions.
#[derive(Default)]
pub struct TerminalManager {
    pub sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Helper function to detect the user's default shell executable.
fn get_default_shell() -> String {
    if cfg!(target_os = "windows") {
        if let Ok(ps) = std::env::var("COMSPEC") {
            if !ps.is_empty() {
                return ps;
            }
        }
        "powershell.exe".to_string()
    } else {
        if let Ok(shell) = std::env::var("SHELL") {
            if !shell.trim().is_empty() && Path::new(&shell).exists() {
                return shell;
            }
        }
        if Path::new("/bin/zsh").exists() {
            "/bin/zsh".to_string()
        } else if Path::new("/bin/bash").exists() {
            "/bin/bash".to_string()
        } else {
            "/bin/sh".to_string()
        }
    }
}

/// Tauri command to create a new interactive PTY terminal session.
#[tauri::command]
pub async fn create_terminal_session(
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, AppError> {
    let session_id = uuid::Uuid::now_v7().to_string();
    tracing::info!("Creating terminal session: {}", session_id);

    // Resolve working directory
    let working_dir: PathBuf = if let Some(ref c) = cwd {
        if !c.trim().is_empty() && Path::new(c).exists() {
            PathBuf::from(c)
        } else {
            let ws = state.workspace.lock().await;
            ws.as_ref()
                .map(|w| w.path.clone())
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        }
    } else {
        let ws = state.workspace.lock().await;
        ws.as_ref()
            .map(|w| w.path.clone())
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    };

    let pty_system = native_pty_system();
    let size = PtySize {
        rows: if rows == 0 { 24 } else { rows },
        cols: if cols == 0 { 80 } else { cols },
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system.openpty(size).map_err(|e| {
        AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;

    let shell = get_default_shell();
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(working_dir);
    for (k, v) in std::env::vars() {
        cmd.env(k, v);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let _child = pair.slave.spawn_command(cmd).map_err(|e| {
        AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;

    // Drop slave in the parent process so EOF on stdout is properly received when child exits
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| {
        AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;

    let writer = pair.master.take_writer().map_err(|e| {
        AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;

    let writer_arc = Arc::new(Mutex::new(writer));
    let buffer = Arc::new(Mutex::new(Vec::with_capacity(65536)));

    // Spawn background reader thread to stream PTY stdout/stderr to frontend via Tauri event
    let session_id_clone = session_id.clone();
    let app_handle_clone = app_handle.clone();
    let buffer_clone = buffer.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let event_name = format!("terminal-data-{}", session_id_clone);
        let exit_event = format!("terminal-exit-{}", session_id_clone);

        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 {
                break;
            }
            {
                let mut b = buffer_clone.lock().unwrap();
                b.extend_from_slice(&buf[..n]);
                if b.len() > 1_000_000 {
                    let trim = b.len() - 1_000_000;
                    b.drain(0..trim);
                }
            }
            let data = String::from_utf8_lossy(&buf[..n]).to_string();
            let _ = app_handle_clone.emit(&event_name, data);
        }
        let _ = app_handle_clone.emit(&exit_event, ());
        tracing::info!("Terminal session {} reader thread ended", session_id_clone);
    });

    let session = TerminalSession {
        id: session_id.clone(),
        master: pair.master,
        writer: writer_arc,
        buffer,
    };

    state
        .terminal_manager
        .sessions
        .lock()
        .unwrap()
        .insert(session_id.clone(), session);

    tracing::info!(
        "Terminal session {} started with shell: {}",
        session_id,
        shell
    );

    Ok(session_id)
}

/// Tauri command to get buffered terminal output (useful on initial attach).
#[tauri::command]
pub async fn get_terminal_buffer(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let sessions = state.terminal_manager.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&session_id) {
        let buf = session.buffer.lock().unwrap();
        Ok(String::from_utf8_lossy(&buf).to_string())
    } else {
        Ok(String::new())
    }
}

/// Tauri command to write raw input data / keystrokes into the terminal stdin.
#[tauri::command]
pub async fn write_terminal(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let sessions = state.terminal_manager.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&session_id) {
        let mut writer = session.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| AppError::Io(e))?;
        writer.flush().map_err(|e| AppError::Io(e))?;
        Ok(())
    } else {
        Err(AppError::ItemNotFound(format!(
            "Terminal session {} not found",
            session_id
        )))
    }
}

/// Tauri command to resize terminal columns and rows.
#[tauri::command]
pub async fn resize_terminal(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut sessions = state.terminal_manager.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
        let size = PtySize {
            rows: if rows == 0 { 24 } else { rows },
            cols: if cols == 0 { 80 } else { cols },
            pixel_width: 0,
            pixel_height: 0,
        };
        let _ = session.master.resize(size);
        Ok(())
    } else {
        Err(AppError::ItemNotFound(format!(
            "Terminal session {} not found",
            session_id
        )))
    }
}

/// Tauri command to close a single terminal session and kill its process.
#[tauri::command]
pub async fn close_terminal(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    tracing::info!("Closing terminal session: {}", session_id);
    let mut sessions = state.terminal_manager.sessions.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}

/// Tauri command to close all active terminal sessions when panel is hidden/closed.
#[tauri::command]
pub async fn close_all_terminals(state: State<'_, AppState>) -> Result<(), AppError> {
    tracing::info!("Closing all terminal sessions");
    let mut sessions = state.terminal_manager.sessions.lock().unwrap();
    sessions.clear();
    Ok(())
}

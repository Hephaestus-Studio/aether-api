use crate::errors::AppError;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc::UnboundedSender;

/// Active Pseudo-Terminal (PTY) session.
pub struct PtySession {
    pub id: String,
    pub title: String,
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

impl PtySession {
    /// Writes raw input bytes to the PTY stdin.
    pub fn write_input(&self, data: &[u8]) -> Result<(), AppError> {
        let mut writer_lock = self.writer.lock().map_err(|e| {
            AppError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            ))
        })?;
        writer_lock.write_all(data).map_err(AppError::Io)?;
        writer_lock.flush().map_err(AppError::Io)?;
        Ok(())
    }

    /// Resizes the PTY window geometry.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), AppError> {
        let size = PtySize {
            rows: if rows == 0 { 24 } else { rows },
            cols: if cols == 0 { 80 } else { cols },
            pixel_width: 0,
            pixel_height: 0,
        };
        self.master.resize(size).map_err(|e| {
            AppError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            ))
        })?;
        Ok(())
    }
}

/// Detects the system default shell.
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

/// Thread-safe manager holding active PTY terminal sessions.
#[derive(Default)]
pub struct PtyManager {
    pub sessions: Arc<Mutex<HashMap<String, Arc<PtySession>>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawns a new interactive PTY shell process and starts reading output.
    pub fn create_session(
        &self,
        id: String,
        title: String,
        cwd: Option<PathBuf>,
        cols: u16,
        rows: u16,
        output_sender: UnboundedSender<Vec<u8>>,
    ) -> Result<Arc<PtySession>, AppError> {
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
        let mut cmd = CommandBuilder::new(shell);
        if let Some(ref dir) = cwd {
            cmd.cwd(dir);
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| {
            AppError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            ))
        })?;

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

        let session = Arc::new(PtySession {
            id: id.clone(),
            title,
            master: pair.master,
            writer: Arc::new(Mutex::new(writer)),
        });

        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(id.clone(), Arc::clone(&session));
        }

        // Background reader thread
        std::thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            while let Ok(n) = reader.read(&mut buffer) {
                if n == 0 {
                    break;
                }
                if output_sender.send(buffer[..n].to_vec()).is_err() {
                    break;
                }
            }
            drop(child);
        });

        Ok(session)
    }

    /// Closes a PTY session.
    pub fn close_session(&self, id: &str) {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(id);
    }
}

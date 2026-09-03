use crate::errors::AppError;
use crate::models::request::{KeyValuePair, RequestSettings, WebSocketSettings};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::Connector;

/// Event payload emitted to the frontend when a message frame is transferred.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsMessageEvent {
    pub id: String,
    pub tab_id: String,
    pub direction: String, // "in" | "out"
    pub format: String,    // "json" | "text" | "binary" | "ping" | "pong" | "status"
    pub payload: String,
    pub size: usize,
    pub timestamp: i64, // Epoch ms
}

/// Event payload emitted to the frontend when connection status changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsStatusEvent {
    pub tab_id: String,
    pub status: String, // "connecting" | "connected" | "disconnected" | "error"
    pub message: Option<String>,
    pub code: Option<u16>,
    pub timestamp: i64,
}

/// Statistics metrics for an active or closed WebSocket session.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WsMetrics {
    pub sent_count: u64,
    pub received_count: u64,
    pub sent_bytes: u64,
    pub received_bytes: u64,
    pub connected_since: Option<i64>,
}

/// Command sent through internal mpsc channel to the sink writer task.
enum WsWriteCommand {
    SendMessage(Message),
    Close(Option<u16>, Option<String>),
}

/// Represents an active WebSocket session instance.
pub struct WebSocketSession {
    pub tab_id: String,
    pub url: String,
    pub write_tx: mpsc::Sender<WsWriteCommand>,
    pub is_connected: Arc<AtomicBool>,
    pub sent_count: Arc<AtomicU64>,
    pub received_count: Arc<AtomicU64>,
    pub sent_bytes: Arc<AtomicU64>,
    pub received_bytes: Arc<AtomicU64>,
    pub connected_since: Option<i64>,
    pub abort_handle: tokio::task::JoinHandle<()>,
    pub heartbeat_handle: Option<tokio::task::JoinHandle<()>>,
}

/// Thread-safe manager holding active WebSocket sessions across tabs.
#[derive(Default)]
pub struct WebSocketManager {
    sessions: Arc<Mutex<HashMap<String, Arc<WebSocketSession>>>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Establish a new WebSocket connection.
    pub async fn connect(
        &self,
        app_handle: AppHandle,
        tab_id: String,
        url_str: String,
        headers: Vec<KeyValuePair>,
        subprotocols: Vec<String>,
        ws_settings: WebSocketSettings,
        request_settings: RequestSettings,
    ) -> Result<(), AppError> {
        // Disconnect previous session if one exists for this tab
        self.disconnect(&tab_id, None, None).await.ok();

        // Emit "connecting" status
        let now_ms = Utc::now().timestamp_millis();
        let _ = app_handle.emit(
            "ws:status",
            WsStatusEvent {
                tab_id: tab_id.clone(),
                status: "connecting".to_string(),
                message: Some(format!("Connecting to {}", url_str)),
                code: None,
                timestamp: now_ms,
            },
        );

        // Prepare tungstenite request
        let mut request = url_str
            .as_str()
            .into_client_request()
            .map_err(|e| AppError::WebSocketError(format!("Invalid WebSocket URL '{}': {}", url_str, e)))?;

        // Add custom headers
        for h in headers.into_iter().filter(|h| h.enabled && !h.key.trim().is_empty()) {
            if let Ok(header_name) = tokio_tungstenite::tungstenite::http::header::HeaderName::from_bytes(h.key.trim().as_bytes()) {
                if let Ok(header_val) = HeaderValue::from_str(h.value.trim()) {
                    request.headers_mut().insert(header_name, header_val);
                }
            }
        }

        // Subprotocols
        if !subprotocols.is_empty() {
            let subproto_str = subprotocols.join(", ");
            if let Ok(val) = HeaderValue::from_str(&subproto_str) {
                request.headers_mut().insert(
                    tokio_tungstenite::tungstenite::http::header::SEC_WEBSOCKET_PROTOCOL,
                    val,
                );
            }
        }

        // Configure TLS connector
        let connector = if !request_settings.verify_ssl {
            let tls_builder = native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(true)
                .danger_accept_invalid_hostnames(true)
                .build()
                .map_err(|e| AppError::WebSocketError(format!("TLS builder error: {}", e)))?;
            Some(Connector::NativeTls(tls_builder))
        } else {
            None
        };

        // Perform connection handshake
        let connect_result = if let Some(connector) = connector {
            tokio_tungstenite::connect_async_tls_with_config(request, None, false, Some(connector)).await
        } else {
            tokio_tungstenite::connect_async(request).await
        };

        let (ws_stream, _response) = match connect_result {
            Ok(res) => res,
            Err(e) => {
                let err_msg = format!("Handshake failed: {}", e);
                let _ = app_handle.emit(
                    "ws:status",
                    WsStatusEvent {
                        tab_id: tab_id.clone(),
                        status: "error".to_string(),
                        message: Some(err_msg.clone()),
                        code: None,
                        timestamp: Utc::now().timestamp_millis(),
                    },
                );
                return Err(AppError::WebSocketError(err_msg));
            }
        };

        let (mut write_half, mut read_half) = ws_stream.split();
        let (write_tx, mut write_rx) = mpsc::channel::<WsWriteCommand>(64);

        let is_connected = Arc::new(AtomicBool::new(true));
        let sent_count = Arc::new(AtomicU64::new(0));
        let received_count = Arc::new(AtomicU64::new(0));
        let sent_bytes = Arc::new(AtomicU64::new(0));
        let received_bytes = Arc::new(AtomicU64::new(0));
        let connected_since = Some(Utc::now().timestamp_millis());

        // Background Writer Task
        let write_tab_id = tab_id.clone();
        let writer_is_connected = Arc::clone(&is_connected);
        let writer_sent_count = Arc::clone(&sent_count);
        let writer_sent_bytes = Arc::clone(&sent_bytes);

        tokio::spawn(async move {
            while let Some(cmd) = write_rx.recv().await {
                match cmd {
                    WsWriteCommand::SendMessage(msg) => {
                        let payload_len = match &msg {
                            Message::Text(t) => t.len() as u64,
                            Message::Binary(b) => b.len() as u64,
                            Message::Ping(p) => p.len() as u64,
                            Message::Pong(p) => p.len() as u64,
                            _ => 0,
                        };

                        if let Err(err) = write_half.send(msg).await {
                            tracing::warn!("[WS:{}] Write error: {}", write_tab_id, err);
                            writer_is_connected.store(false, Ordering::SeqCst);
                            break;
                        } else {
                            writer_sent_count.fetch_add(1, Ordering::SeqCst);
                            writer_sent_bytes.fetch_add(payload_len, Ordering::SeqCst);
                        }
                    }
                    WsWriteCommand::Close(code, reason) => {
                        let close_frame = code.map(|c| tokio_tungstenite::tungstenite::protocol::frame::CloseFrame {
                            code: tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode::from(c),
                            reason: reason.unwrap_or_default().into(),
                        });
                        let _ = write_half.send(Message::Close(close_frame)).await;
                        let _ = write_half.close().await;
                        writer_is_connected.store(false, Ordering::SeqCst);
                        break;
                    }
                }
            }
        });

        // Background Reader Task
        let read_app_handle = app_handle.clone();
        let read_tab_id = tab_id.clone();
        let read_is_connected = Arc::clone(&is_connected);
        let read_received_count = Arc::clone(&received_count);
        let read_received_bytes = Arc::clone(&received_bytes);
        let sessions_clone = Arc::clone(&self.sessions);
        let auto_pong = ws_settings.auto_pong;
        let reader_write_tx = write_tx.clone();

        let abort_handle = tokio::spawn(async move {
            while let Some(msg_result) = read_half.next().await {
                match msg_result {
                    Ok(Message::Text(text)) => {
                        let size = text.len();
                        read_received_count.fetch_add(1, Ordering::SeqCst);
                        read_received_bytes.fetch_add(size as u64, Ordering::SeqCst);

                        let text_str = text.to_string();
                        let format = if serde_json::from_str::<serde_json::Value>(&text_str).is_ok() {
                            "json"
                        } else {
                            "text"
                        };

                        let _ = read_app_handle.emit(
                            "ws:message",
                            WsMessageEvent {
                                id: uuid::Uuid::now_v7().to_string(),
                                tab_id: read_tab_id.clone(),
                                direction: "in".to_string(),
                                format: format.to_string(),
                                payload: text_str,
                                size,
                                timestamp: Utc::now().timestamp_millis(),
                            },
                        );
                    }
                    Ok(Message::Binary(bin)) => {
                        let size = bin.len();
                        read_received_count.fetch_add(1, Ordering::SeqCst);
                        read_received_bytes.fetch_add(size as u64, Ordering::SeqCst);

                        let b64_payload = BASE64.encode(&bin);
                        let _ = read_app_handle.emit(
                            "ws:message",
                            WsMessageEvent {
                                id: uuid::Uuid::now_v7().to_string(),
                                tab_id: read_tab_id.clone(),
                                direction: "in".to_string(),
                                format: "binary".to_string(),
                                payload: b64_payload,
                                size,
                                timestamp: Utc::now().timestamp_millis(),
                            },
                        );
                    }
                    Ok(Message::Ping(payload)) => {
                        let size = payload.len();
                        let _ = read_app_handle.emit(
                            "ws:message",
                            WsMessageEvent {
                                id: uuid::Uuid::now_v7().to_string(),
                                tab_id: read_tab_id.clone(),
                                direction: "in".to_string(),
                                format: "ping".to_string(),
                                payload: String::from_utf8_lossy(&payload).to_string(),
                                size,
                                timestamp: Utc::now().timestamp_millis(),
                            },
                        );

                        if auto_pong {
                            let _ = reader_write_tx
                                .send(WsWriteCommand::SendMessage(Message::Pong(payload)))
                                .await;
                        }
                    }
                    Ok(Message::Pong(payload)) => {
                        let size = payload.len();
                        let _ = read_app_handle.emit(
                            "ws:message",
                            WsMessageEvent {
                                id: uuid::Uuid::now_v7().to_string(),
                                tab_id: read_tab_id.clone(),
                                direction: "in".to_string(),
                                format: "pong".to_string(),
                                payload: String::from_utf8_lossy(&payload).to_string(),
                                size,
                                timestamp: Utc::now().timestamp_millis(),
                            },
                        );
                    }
                    Ok(Message::Close(frame)) => {
                        let (code, reason) = if let Some(f) = frame {
                            (Some(u16::from(f.code)), Some(f.reason.to_string()))
                        } else {
                            (None, None)
                        };

                        let _ = read_app_handle.emit(
                            "ws:status",
                            WsStatusEvent {
                                tab_id: read_tab_id.clone(),
                                status: "disconnected".to_string(),
                                message: reason,
                                code,
                                timestamp: Utc::now().timestamp_millis(),
                            },
                        );
                        break;
                    }
                    Ok(Message::Frame(_)) => {}
                    Err(err) => {
                        let _ = read_app_handle.emit(
                            "ws:status",
                            WsStatusEvent {
                                tab_id: read_tab_id.clone(),
                                status: "error".to_string(),
                                message: Some(format!("WebSocket read error: {}", err)),
                                code: None,
                                timestamp: Utc::now().timestamp_millis(),
                            },
                        );
                        break;
                    }
                }
            }

            read_is_connected.store(false, Ordering::SeqCst);
            // Remove from active sessions
            let mut lock = sessions_clone.lock().await;
            lock.remove(&read_tab_id);
        });

        // Heartbeat timer task (if enabled)
        let heartbeat_handle = if ws_settings.heartbeat_interval_secs > 0 {
            let hb_tx = write_tx.clone();
            let hb_interval = Duration::from_secs(ws_settings.heartbeat_interval_secs);
            let hb_connected = Arc::clone(&is_connected);
            let hb_app = app_handle.clone();
            let hb_tab_id = tab_id.clone();

            Some(tokio::spawn(async move {
                let mut interval = tokio::time::interval(hb_interval);
                interval.tick().await; // skip initial immediate tick
                while hb_connected.load(Ordering::SeqCst) {
                    interval.tick().await;
                    if !hb_connected.load(Ordering::SeqCst) {
                        break;
                    }
                    let ping_payload = b"ping".to_vec();
                    if hb_tx
                        .send(WsWriteCommand::SendMessage(Message::Ping(ping_payload.into())))
                        .await
                        .is_err()
                    {
                        break;
                    }
                    let _ = hb_app.emit(
                        "ws:message",
                        WsMessageEvent {
                            id: uuid::Uuid::now_v7().to_string(),
                            tab_id: hb_tab_id.clone(),
                            direction: "out".to_string(),
                            format: "ping".to_string(),
                            payload: "ping".to_string(),
                            size: 4,
                            timestamp: Utc::now().timestamp_millis(),
                        },
                    );
                }
            }))
        } else {
            None
        };

        let session = Arc::new(WebSocketSession {
            tab_id: tab_id.clone(),
            url: url_str,
            write_tx,
            is_connected,
            sent_count,
            received_count,
            sent_bytes,
            received_bytes,
            connected_since,
            abort_handle,
            heartbeat_handle,
        });

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(tab_id.clone(), session);
        }

        // Emit "connected" status
        let _ = app_handle.emit(
            "ws:status",
            WsStatusEvent {
                tab_id,
                status: "connected".to_string(),
                message: Some("Connected successfully".to_string()),
                code: None,
                timestamp: Utc::now().timestamp_millis(),
            },
        );

        Ok(())
    }

    /// Send a message frame to an active WebSocket connection.
    pub async fn send_message(
        &self,
        app_handle: &AppHandle,
        tab_id: &str,
        format: &str,
        payload: &str,
    ) -> Result<WsMessageEvent, AppError> {
        let session = {
            let sessions = self.sessions.lock().await;
            sessions
                .get(tab_id)
                .cloned()
                .ok_or_else(|| AppError::WebSocketError("WebSocket connection not active".to_string()))?
        };

        if !session.is_connected.load(Ordering::SeqCst) {
            return Err(AppError::WebSocketError("WebSocket connection is closed".to_string()));
        }

        let (msg, byte_size) = match format.to_lowercase().as_str() {
            "binary" => {
                // Decode base64 or hex
                let bytes = if let Ok(decoded) = BASE64.decode(payload.trim()) {
                    decoded
                } else if let Ok(hex_decoded) = hex_to_bytes(payload.trim()) {
                    hex_decoded
                } else {
                    payload.as_bytes().to_vec()
                };
                let size = bytes.len();
                (Message::Binary(bytes.into()), size)
            }
            "ping" => {
                let bytes = payload.as_bytes().to_vec();
                let size = bytes.len();
                (Message::Ping(bytes.into()), size)
            }
            "pong" => {
                let bytes = payload.as_bytes().to_vec();
                let size = bytes.len();
                (Message::Pong(bytes.into()), size)
            }
            _ => {
                // Text or JSON
                let size = payload.len();
                (Message::Text(payload.to_string().into()), size)
            }
        };

        session
            .write_tx
            .send(WsWriteCommand::SendMessage(msg))
            .await
            .map_err(|e| AppError::WebSocketError(format!("Failed to send frame: {}", e)))?;

        let event = WsMessageEvent {
            id: uuid::Uuid::now_v7().to_string(),
            tab_id: tab_id.to_string(),
            direction: "out".to_string(),
            format: format.to_string(),
            payload: payload.to_string(),
            size: byte_size,
            timestamp: Utc::now().timestamp_millis(),
        };

        let _ = app_handle.emit("ws:message", &event);

        Ok(event)
    }

    /// Send a Ping frame manually.
    pub async fn send_ping(&self, app_handle: &AppHandle, tab_id: &str, payload: Option<String>) -> Result<(), AppError> {
        let content = payload.unwrap_or_else(|| "ping".to_string());
        self.send_message(app_handle, tab_id, "ping", &content).await?;
        Ok(())
    }

    /// Disconnect an active WebSocket session.
    pub async fn disconnect(
        &self,
        tab_id: &str,
        code: Option<u16>,
        reason: Option<String>,
    ) -> Result<(), AppError> {
        let session = {
            let mut sessions = self.sessions.lock().await;
            sessions.remove(tab_id)
        };

        if let Some(s) = session {
            s.is_connected.store(false, Ordering::SeqCst);
            let _ = s.write_tx.send(WsWriteCommand::Close(code, reason)).await;
            s.abort_handle.abort();
            if let Some(ref hb) = s.heartbeat_handle {
                hb.abort();
            }
        }

        Ok(())
    }

    /// Get the current status and metrics of a session.
    pub async fn get_metrics(&self, tab_id: &str) -> Option<WsMetrics> {
        let sessions = self.sessions.lock().await;
        sessions.get(tab_id).map(|s| WsMetrics {
            sent_count: s.sent_count.load(Ordering::SeqCst),
            received_count: s.received_count.load(Ordering::SeqCst),
            sent_bytes: s.sent_bytes.load(Ordering::SeqCst),
            received_bytes: s.received_bytes.load(Ordering::SeqCst),
            connected_since: s.connected_since,
        })
    }

    /// Disconnect all active WebSocket sessions (called when app closes or workspace changes).
    pub async fn close_all(&self) {
        let mut sessions = self.sessions.lock().await;
        for (_, session) in sessions.drain() {
            session.is_connected.store(false, Ordering::SeqCst);
            let _ = session.write_tx.send(WsWriteCommand::Close(Some(1000), Some("App shutting down".to_string()))).await;
            session.abort_handle.abort();
            if let Some(ref hb) = session.heartbeat_handle {
                hb.abort();
            }
        }
    }
}

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, ()> {
    let clean_hex: String = hex.chars().filter(|c| !c.is_whitespace()).collect();
    if clean_hex.len() % 2 != 0 {
        return Err(());
    }
    (0..clean_hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&clean_hex[i..i + 2], 16).map_err(|_| ()))
        .collect()
}

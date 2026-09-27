use aether_core::engine::websocket_client::{WsEvent, WsMessageEvent, WsMetrics};
use aether_core::models::request::WebSocketSavedMessage;
use serde::{Deserialize, Serialize};

/// Connection state for WebSocket session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum WsConnectionStatus {
    #[default]
    Disconnected,
    Connecting,
    Connected,
    Error,
}

/// Message stream filter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WsFilter {
    #[default]
    All,
    Incoming,
    Outgoing,
    PingPong,
}

/// Active subtab in the top configuration area of WebSocket Editor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WsSubtab {
    #[default]
    Params,
    Headers,
    Auth,
    Saved,
    Settings,
}

/// Holds active runtime state for a WebSocket tab session.
#[derive(Debug, Clone)]
pub struct WebSocketTabState {
    pub connection_status: WsConnectionStatus,
    pub status_message: Option<String>,
    pub status_code: Option<u16>,
    pub messages: Vec<WsMessageEvent>,
    pub metrics: WsMetrics,
    pub composer_payload: String,
    pub composer_format: String, // "json" | "text" | "binary"
    pub active_subtab: WsSubtab,
    pub filter: WsFilter,
    pub search_query: String,
    pub auto_scroll: bool,
    pub saved_messages: Vec<WebSocketSavedMessage>,
    pub tx: Option<tokio::sync::mpsc::UnboundedSender<WsEvent>>,
}

impl Default for WebSocketTabState {
    fn default() -> Self {
        Self {
            connection_status: WsConnectionStatus::Disconnected,
            status_message: None,
            status_code: None,
            messages: Vec::new(),
            metrics: WsMetrics::default(),
            composer_payload: "{\n  \"action\": \"ping\"\n}".to_string(),
            composer_format: "json".to_string(),
            active_subtab: WsSubtab::Params,
            filter: WsFilter::All,
            search_query: String::new(),
            auto_scroll: true,
            saved_messages: Vec::new(),
            tx: None,
        }
    }
}

impl WebSocketTabState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Handles an incoming WebSocket event from the engine.
    pub fn handle_event(&mut self, event: WsEvent) {
        match event {
            WsEvent::Message(msg) => {
                if msg.direction == "in" {
                    self.metrics.received_count += 1;
                    self.metrics.received_bytes += msg.size as u64;
                } else {
                    self.metrics.sent_count += 1;
                    self.metrics.sent_bytes += msg.size as u64;
                }
                self.messages.push(msg);
                if self.messages.len() > 2000 {
                    self.messages.remove(0);
                }
            }
            WsEvent::Status(status) => {
                self.connection_status = match status.status.as_str() {
                    "connected" => {
                        self.metrics.connected_since = Some(status.timestamp);
                        WsConnectionStatus::Connected
                    }
                    "connecting" => WsConnectionStatus::Connecting,
                    "error" => WsConnectionStatus::Error,
                    _ => {
                        self.metrics.connected_since = None;
                        WsConnectionStatus::Disconnected
                    }
                };
                self.status_message = status.message;
                self.status_code = status.code;
            }
        }
    }

    /// Returns filtered messages matching the active filter and search query.
    pub fn filtered_messages(&self) -> Vec<&WsMessageEvent> {
        let q = self.search_query.trim().to_lowercase();

        self.messages
            .iter()
            .filter(|m| {
                let matches_filter = match self.filter {
                    WsFilter::All => true,
                    WsFilter::Incoming => m.direction == "in",
                    WsFilter::Outgoing => m.direction == "out",
                    WsFilter::PingPong => m.format == "ping" || m.format == "pong",
                };

                if !matches_filter {
                    return false;
                }

                if q.is_empty() {
                    true
                } else {
                    m.payload.to_lowercase().contains(&q)
                }
            })
            .collect()
    }

    /// Clears message history.
    pub fn clear_messages(&mut self) {
        self.messages.clear();
        self.metrics.sent_count = 0;
        self.metrics.received_count = 0;
        self.metrics.sent_bytes = 0;
        self.metrics.received_bytes = 0;
    }
}

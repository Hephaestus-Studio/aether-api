use aether_core::engine::sse_client::{SseEventPayload, SseMessage, SseMetrics};
use serde::{Deserialize, Serialize};

/// Connection state for Server-Sent Events session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum SseConnectionStatus {
    #[default]
    Disconnected,
    Connecting,
    Connected,
    Error,
}

/// Active subtab in the configuration area of SSE Editor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SseSubtab {
    #[default]
    Params,
    Headers,
    Auth,
    Body,
    Settings,
}

/// Holds active runtime state for a Server-Sent Events (SSE) tab session.
#[derive(Debug, Clone)]
pub struct SseTabState {
    pub connection_status: SseConnectionStatus,
    pub status_message: Option<String>,
    pub status_code: Option<u16>,
    pub events: Vec<SseEventPayload>,
    pub metrics: SseMetrics,
    pub active_subtab: SseSubtab,
    pub selected_event_type: Option<String>,
    pub search_query: String,
    pub auto_scroll: bool,
}

impl Default for SseTabState {
    fn default() -> Self {
        Self {
            connection_status: SseConnectionStatus::Disconnected,
            status_message: None,
            status_code: None,
            events: Vec::new(),
            metrics: SseMetrics::default(),
            active_subtab: SseSubtab::Params,
            selected_event_type: None,
            search_query: String::new(),
            auto_scroll: true,
        }
    }
}

impl SseTabState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Handles an incoming SSE event/status message from the engine.
    pub fn handle_message(&mut self, message: SseMessage) {
        match message {
            SseMessage::Event(ev) => {
                self.metrics.received_count += 1;
                self.metrics.received_bytes += ev.size as u64;
                self.events.push(ev);
                if self.events.len() > 2000 {
                    self.events.remove(0);
                }
            }
            SseMessage::Status(status) => {
                self.connection_status = match status.status.as_str() {
                    "connected" => {
                        self.metrics.connected_since = Some(status.timestamp);
                        SseConnectionStatus::Connected
                    }
                    "connecting" => SseConnectionStatus::Connecting,
                    "error" => SseConnectionStatus::Error,
                    _ => {
                        self.metrics.connected_since = None;
                        SseConnectionStatus::Disconnected
                    }
                };
                self.status_message = status.message;
                self.status_code = status.status_code;
            }
        }
    }

    /// Returns unique event types seen in the event stream.
    pub fn unique_event_types(&self) -> Vec<String> {
        let mut types = Vec::new();
        for ev in &self.events {
            if !types.contains(&ev.event) {
                types.push(ev.event.clone());
            }
        }
        types
    }

    /// Returns filtered events matching the active event type and search query.
    pub fn filtered_events(&self) -> Vec<&SseEventPayload> {
        let q = self.search_query.trim().to_lowercase();

        self.events
            .iter()
            .filter(|ev| {
                if let Some(target_type) = &self.selected_event_type {
                    if target_type != "all" && &ev.event != target_type {
                        return false;
                    }
                }

                if q.is_empty() {
                    true
                } else {
                    ev.data.to_lowercase().contains(&q) || ev.event.to_lowercase().contains(&q)
                }
            })
            .collect()
    }

    /// Clears event history.
    pub fn clear_events(&mut self) {
        self.events.clear();
        self.metrics.received_count = 0;
        self.metrics.received_bytes = 0;
    }
}

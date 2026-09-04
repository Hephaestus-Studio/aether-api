use crate::engine::http_client::sanitize_json_payload;
use crate::errors::AppError;
use crate::models::request::{
    AuthConfig, HttpMethod, KeyValuePair, MultipartFieldType, RequestBody, RequestSettings,
    SseSettings,
};
use chrono::Utc;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, ACCEPT, CACHE_CONTROL, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

/// Event payload emitted to the frontend when a single SSE event frame is parsed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseEventPayload {
    pub id: String,
    pub tab_id: String,
    pub event: String,
    pub data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry: Option<u64>,
    pub timestamp: i64,
    pub size: usize,
}

/// Event payload emitted to the frontend when SSE connection status changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseStatusPayload {
    pub tab_id: String,
    pub status: String, // "connecting" | "connected" | "disconnected" | "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub timestamp: i64,
}

/// Statistics metrics for an active or closed SSE session.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SseMetrics {
    pub received_count: u64,
    pub received_bytes: u64,
    pub connected_since: Option<i64>,
}

/// Represents an active Server-Sent Events session instance.
#[allow(dead_code)]
pub struct SseSession {
    pub tab_id: String,
    pub url: String,
    pub is_connected: Arc<AtomicBool>,
    pub received_count: Arc<AtomicU64>,
    pub received_bytes: Arc<AtomicU64>,
    pub connected_since: Option<i64>,
    pub cancel_token: CancellationToken,
}

/// Thread-safe manager holding active SSE sessions across tabs.
#[derive(Default)]
pub struct SseManager {
    sessions: Arc<Mutex<HashMap<String, Arc<SseSession>>>>,
}

impl SseManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Establish a new SSE connection for a specific tab.
    pub async fn connect(
        &self,
        app_handle: AppHandle,
        tab_id: String,
        method: HttpMethod,
        url_str: String,
        params: Vec<KeyValuePair>,
        headers: Vec<KeyValuePair>,
        body: RequestBody,
        auth: AuthConfig,
        sse_settings: SseSettings,
        request_settings: RequestSettings,
    ) -> Result<(), AppError> {
        // Disconnect previous session if one exists
        self.disconnect(&tab_id).await.ok();

        let cancel_token = CancellationToken::new();
        let is_connected = Arc::new(AtomicBool::new(false));
        let received_count = Arc::new(AtomicU64::new(0));
        let received_bytes = Arc::new(AtomicU64::new(0));
        let now_ms = Utc::now().timestamp_millis();

        let session = Arc::new(SseSession {
            tab_id: tab_id.clone(),
            url: url_str.clone(),
            is_connected: Arc::clone(&is_connected),
            received_count: Arc::clone(&received_count),
            received_bytes: Arc::clone(&received_bytes),
            connected_since: Some(now_ms),
            cancel_token: cancel_token.clone(),
        });

        {
            let mut sessions_guard = self.sessions.lock().await;
            sessions_guard.insert(tab_id.clone(), Arc::clone(&session));
        }

        // Notify UI: connecting
        let _ = app_handle.emit(
            "sse:status",
            SseStatusPayload {
                tab_id: tab_id.clone(),
                status: "connecting".to_string(),
                status_code: None,
                message: Some(format!("Connecting to {}", url_str)),
                timestamp: now_ms,
            },
        );

        let sessions_map = Arc::clone(&self.sessions);
        let tab_id_clone = tab_id.clone();

        // Spawn background task to stream events
        tauri::async_runtime::spawn(async move {
            let mut attempt = 0;
            let max_attempts = if sse_settings.auto_reconnect {
                sse_settings.max_reconnect_attempts
            } else {
                1
            };

            let mut last_event_id: Option<String> = None;
            let mut retry_delay_ms = sse_settings.reconnect_interval_ms;

            while !cancel_token.is_cancelled() && attempt < max_attempts {
                attempt += 1;

                if attempt > 1 {
                    tracing::info!(
                        "Reconnecting SSE for tab {} (attempt {}/{}) after {}ms",
                        tab_id_clone,
                        attempt,
                        max_attempts,
                        retry_delay_ms
                    );
                    let _ = app_handle.emit(
                        "sse:status",
                        SseStatusPayload {
                            tab_id: tab_id_clone.clone(),
                            status: "connecting".to_string(),
                            status_code: None,
                            message: Some(format!(
                                "Reconnecting (attempt {}/{})...",
                                attempt, max_attempts
                            )),
                            timestamp: Utc::now().timestamp_millis(),
                        },
                    );

                    tokio::select! {
                        _ = cancel_token.cancelled() => break,
                        _ = tokio::time::sleep(Duration::from_millis(retry_delay_ms)) => {}
                    }

                    if cancel_token.is_cancelled() {
                        break;
                    }
                }

                let stream_res = run_sse_stream(
                    &app_handle,
                    &tab_id_clone,
                    &method,
                    &url_str,
                    &params,
                    &headers,
                    &body,
                    &auth,
                    &request_settings,
                    &cancel_token,
                    &is_connected,
                    &received_count,
                    &received_bytes,
                    &mut last_event_id,
                    &mut retry_delay_ms,
                )
                .await;

                is_connected.store(false, Ordering::SeqCst);

                if cancel_token.is_cancelled() {
                    break;
                }

                if let Err(e) = stream_res {
                    tracing::warn!("SSE stream ended with error: {}", e);
                    let _ = app_handle.emit(
                        "sse:status",
                        SseStatusPayload {
                            tab_id: tab_id_clone.clone(),
                            status: "error".to_string(),
                            status_code: None,
                            message: Some(e.to_string()),
                            timestamp: Utc::now().timestamp_millis(),
                        },
                    );
                }

                if !sse_settings.auto_reconnect {
                    break;
                }
            }

            // Clean up session in manager
            {
                let mut guard = sessions_map.lock().await;
                if let Some(s) = guard.get(&tab_id_clone) {
                    if s.cancel_token.is_cancelled() || !s.is_connected.load(Ordering::SeqCst) {
                        guard.remove(&tab_id_clone);
                    }
                }
            }

            let _ = app_handle.emit(
                "sse:status",
                SseStatusPayload {
                    tab_id: tab_id_clone,
                    status: "disconnected".to_string(),
                    status_code: None,
                    message: Some("Stream closed".to_string()),
                    timestamp: Utc::now().timestamp_millis(),
                },
            );
        });

        Ok(())
    }

    /// Disconnect an active SSE session for a specific tab.
    pub async fn disconnect(&self, tab_id: &str) -> Result<(), AppError> {
        let mut guard = self.sessions.lock().await;
        if let Some(session) = guard.remove(tab_id) {
            session.is_connected.store(false, Ordering::SeqCst);
            session.cancel_token.cancel();
            tracing::info!("SSE session cancelled for tab: {}", tab_id);
        }
        Ok(())
    }

    /// Disconnect all active SSE sessions (e.g. when app shuts down).
    pub async fn close_all(&self) {
        let mut guard = self.sessions.lock().await;
        for (tab_id, session) in guard.drain() {
            session.is_connected.store(false, Ordering::SeqCst);
            session.cancel_token.cancel();
            tracing::info!("Closed SSE session for tab: {}", tab_id);
        }
    }

    /// Retrieve session statistics for a given tab.
    pub async fn get_metrics(&self, tab_id: &str) -> SseMetrics {
        let guard = self.sessions.lock().await;
        if let Some(session) = guard.get(tab_id) {
            SseMetrics {
                received_count: session.received_count.load(Ordering::Relaxed),
                received_bytes: session.received_bytes.load(Ordering::Relaxed),
                connected_since: session.connected_since,
            }
        } else {
            SseMetrics::default()
        }
    }
}

/// Helper function to execute and stream an SSE connection.
async fn run_sse_stream(
    app_handle: &AppHandle,
    tab_id: &str,
    method: &HttpMethod,
    url_str: &str,
    params: &[KeyValuePair],
    headers: &[KeyValuePair],
    body: &RequestBody,
    auth: &AuthConfig,
    request_settings: &RequestSettings,
    cancel_token: &CancellationToken,
    is_connected: &Arc<AtomicBool>,
    received_count: &Arc<AtomicU64>,
    received_bytes: &Arc<AtomicU64>,
    last_event_id: &mut Option<String>,
    retry_delay_ms: &mut u64,
) -> Result<(), AppError> {
    // Build HTTP client
    let mut client_builder = reqwest::Client::builder();
    if !request_settings.verify_ssl {
        client_builder = client_builder.danger_accept_invalid_certs(true);
    }
    if request_settings.timeout_ms > 0 {
        client_builder =
            client_builder.connect_timeout(Duration::from_millis(request_settings.timeout_ms));
    }
    if !request_settings.follow_redirects {
        client_builder = client_builder.redirect(reqwest::redirect::Policy::none());
    }

    let client = client_builder
        .build()
        .map_err(|e| AppError::NetworkError(e))?;

    let reqwest_method = match method {
        HttpMethod::Get => reqwest::Method::GET,
        HttpMethod::Post => reqwest::Method::POST,
        HttpMethod::Put => reqwest::Method::PUT,
        HttpMethod::Patch => reqwest::Method::PATCH,
        HttpMethod::Delete => reqwest::Method::DELETE,
        HttpMethod::Head => reqwest::Method::HEAD,
        HttpMethod::Options => reqwest::Method::OPTIONS,
        HttpMethod::Custom(m) => {
            reqwest::Method::from_bytes(m.as_bytes()).unwrap_or(reqwest::Method::GET)
        }
    };

    let mut builder = client.request(reqwest_method, url_str);

    // Apply query parameters
    let query_pairs: Vec<(&str, &str)> = params
        .iter()
        .filter(|p| p.enabled && !p.key.trim().is_empty())
        .map(|p| (p.key.as_str(), p.value.as_str()))
        .collect();
    if !query_pairs.is_empty() {
        builder = builder.query(&query_pairs);
    }

    // Apply standard SSE headers
    let mut header_map = HeaderMap::new();
    header_map.insert(ACCEPT, HeaderValue::from_static("text/event-stream"));
    header_map.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));

    if let Some(id) = last_event_id.as_ref() {
        if let Ok(val) = HeaderValue::from_str(id) {
            header_map.insert(
                HeaderName::from_static("last-event-id"),
                val,
            );
        }
    }

    // Apply custom headers
    for h in headers.iter().filter(|h| h.enabled && !h.key.trim().is_empty()) {
        if let (Ok(name), Ok(val)) = (
            HeaderName::from_bytes(h.key.as_bytes()),
            HeaderValue::from_str(&h.value),
        ) {
            header_map.insert(name, val);
        }
    }
    builder = builder.headers(header_map);

    // Apply Authentication
    builder = match auth {
        AuthConfig::Bearer { bearer } => {
            let prefix = bearer.prefix.as_deref().unwrap_or("Bearer").trim();
            let prefix_str = if prefix.is_empty() { "Bearer" } else { prefix };
            builder.header("Authorization", format!("{} {}", prefix_str, bearer.token))
        }
        AuthConfig::Basic { basic } => {
            builder.basic_auth(&basic.username, Some(&basic.password))
        }
        AuthConfig::ApiKey { apikey } => {
            if apikey.add_to == "query" {
                builder.query(&[(&apikey.key, &apikey.value)])
            } else {
                builder.header(&apikey.key, &apikey.value)
            }
        }
        AuthConfig::None | AuthConfig::Inherit => builder,
    };

    // Apply Request Body if method is POST/PUT/PATCH
    if method == &HttpMethod::Post || method == &HttpMethod::Put || method == &HttpMethod::Patch {
        builder = match body {
            RequestBody::None { .. } => builder,
            RequestBody::Json { content } => {
                let sanitized = sanitize_json_payload(content);
                builder
                    .header(CONTENT_TYPE, "application/json")
                    .body(sanitized)
            }
            RequestBody::Text { content } => {
                builder.header(CONTENT_TYPE, "text/plain").body(content.clone())
            }
            RequestBody::FormUrlencoded { content } => {
                let pairs: Vec<(&str, &str)> = content
                    .iter()
                    .filter(|kv| kv.enabled)
                    .map(|kv| (kv.key.as_str(), kv.value.as_str()))
                    .collect();
                builder.form(&pairs)
            }
            RequestBody::MultipartForm { content } => {
                let mut form = reqwest::multipart::Form::new();
                for field in content.iter().filter(|f| f.enabled) {
                    match field.field_type {
                        MultipartFieldType::Text => {
                            form = form.text(field.key.clone(), field.value.clone());
                        }
                        MultipartFieldType::File => {
                            let file_bytes = tokio::fs::read(&field.value).await.map_err(AppError::Io)?;
                            let filename = std::path::Path::new(&field.value)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("file")
                                .to_string();
                            let part = reqwest::multipart::Part::bytes(file_bytes).file_name(filename);
                            form = form.part(field.key.clone(), part);
                        }
                    }
                }
                builder.multipart(form)
            }
            _ => builder,
        };
    }

    // Send HTTP request
    let response = tokio::select! {
        _ = cancel_token.cancelled() => return Ok(()),
        res = builder.send() => res.map_err(AppError::NetworkError)?,
    };

    let status = response.status();
    let status_u16 = status.as_u16();

    if !status.is_success() {
        let err_text = response.text().await.unwrap_or_default();
        let msg = format!("Server returned HTTP {} {}: {}", status_u16, status.canonical_reason().unwrap_or(""), err_text);
        let _ = app_handle.emit(
            "sse:status",
            SseStatusPayload {
                tab_id: tab_id.to_string(),
                status: "error".to_string(),
                status_code: Some(status_u16),
                message: Some(msg.clone()),
                timestamp: Utc::now().timestamp_millis(),
            },
        );
        return Err(AppError::SseError(msg));
    }

    // Connected successfully!
    is_connected.store(true, Ordering::SeqCst);
    let _ = app_handle.emit(
        "sse:status",
        SseStatusPayload {
            tab_id: tab_id.to_string(),
            status: "connected".to_string(),
            status_code: Some(status_u16),
            message: Some("Stream connected".to_string()),
            timestamp: Utc::now().timestamp_millis(),
        },
    );

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    let mut current_event = "message".to_string();
    let mut current_data = Vec::<String>::new();
    let mut current_id: Option<String> = None;
    let mut current_retry: Option<u64> = None;

    while let Some(chunk_result) = tokio::select! {
        _ = cancel_token.cancelled() => None,
        item = stream.next() => item,
    } {
        let bytes = chunk_result.map_err(AppError::NetworkError)?;
        let chunk_size = bytes.len() as u64;
        received_bytes.fetch_add(chunk_size, Ordering::Relaxed);

        let text = String::from_utf8_lossy(&bytes);
        buffer.push_str(&text);

        // Process full lines in buffer
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer.drain(..=line_end);

            if line.is_empty() {
                // Empty line triggers dispatch of accumulated event
                if !current_data.is_empty() || current_event != "message" {
                    let data_payload = current_data.join("\n");
                    let size = data_payload.as_bytes().len();
                    let now = Utc::now().timestamp_millis();

                    let event_payload = SseEventPayload {
                        id: Uuid::new_v4().to_string(),
                        tab_id: tab_id.to_string(),
                        event: current_event.clone(),
                        data: data_payload,
                        event_id: current_id.clone(),
                        retry: current_retry,
                        timestamp: now,
                        size,
                    };

                    received_count.fetch_add(1, Ordering::Relaxed);
                    let _ = app_handle.emit("sse:event", event_payload);

                    if let Some(ref eid) = current_id {
                        *last_event_id = Some(eid.clone());
                    }
                    if let Some(ret) = current_retry {
                        *retry_delay_ms = ret;
                    }

                    // Reset for next event
                    current_event = "message".to_string();
                    current_data.clear();
                    current_id = None;
                    current_retry = None;
                }
            } else if line.starts_with(':') {
                // SSE comment (heartbeat / ping) -> ignore or handle
                tracing::trace!("SSE comment: {}", line);
            } else if let Some(stripped) = line.strip_prefix("event:") {
                current_event = stripped.trim().to_string();
            } else if let Some(stripped) = line.strip_prefix("data:") {
                let data_part = stripped.strip_prefix(' ').unwrap_or(stripped);
                current_data.push(data_part.to_string());
            } else if let Some(stripped) = line.strip_prefix("id:") {
                current_id = Some(stripped.trim().to_string());
            } else if let Some(stripped) = line.strip_prefix("retry:") {
                if let Ok(ms) = stripped.trim().parse::<u64>() {
                    current_retry = Some(ms);
                }
            }
        }
    }

    Ok(())
}

/// Unit tests for SSE line parser logic.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sse_event_parsing() {
        let raw = "event: custom\ndata: hello world\nid: 101\n\n";
        let mut buffer = raw.to_string();
        let mut current_event = "message".to_string();
        let mut current_data = Vec::<String>::new();
        let mut current_id: Option<String> = None;
        let mut events = Vec::new();

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer.drain(..=line_end);

            if line.is_empty() {
                if !current_data.is_empty() || current_event != "message" {
                    events.push((current_event.clone(), current_data.join("\n"), current_id.clone()));
                    current_event = "message".to_string();
                    current_data.clear();
                    current_id = None;
                }
            } else if let Some(stripped) = line.strip_prefix("event:") {
                current_event = stripped.trim().to_string();
            } else if let Some(stripped) = line.strip_prefix("data:") {
                let data_part = stripped.strip_prefix(' ').unwrap_or(stripped);
                current_data.push(data_part.to_string());
            } else if let Some(stripped) = line.strip_prefix("id:") {
                current_id = Some(stripped.trim().to_string());
            }
        }

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].0, "custom");
        assert_eq!(events[0].1, "hello world");
        assert_eq!(events[0].2, Some("101".to_string()));
    }

    #[test]
    fn test_sse_multiline_data() {
        let raw = "data: line 1\ndata: line 2\n\n";
        let mut buffer = raw.to_string();
        let mut current_data = Vec::<String>::new();
        let mut events = Vec::new();

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer.drain(..=line_end);

            if line.is_empty() {
                if !current_data.is_empty() {
                    events.push(current_data.join("\n"));
                    current_data.clear();
                }
            } else if let Some(stripped) = line.strip_prefix("data:") {
                let data_part = stripped.strip_prefix(' ').unwrap_or(stripped);
                current_data.push(data_part.to_string());
            }
        }

        assert_eq!(events.len(), 1);
        assert_eq!(events[0], "line 1\nline 2");
    }
}

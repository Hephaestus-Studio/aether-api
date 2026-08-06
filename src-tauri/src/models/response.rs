use serde::{Deserialize, Serialize};

/// Supported types of response bodies.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum ResponseBodyType {
    /// JSON content response.
    Json,
    /// XML content response.
    Xml,
    /// HTML content response.
    Html,
    /// Plain text content response.
    #[default]
    Text,
    /// Binary stream or unrecognized format.
    Binary,
}

/// Timing metrics for different phases of the HTTP request lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimingMetrics {
    /// Time spent resolving the domain name in milliseconds.
    pub dns_ms: f64, // DNS lookup time
    /// Time spent establishing the TCP connection in milliseconds.
    pub tcp_ms: f64, // TCP connection time
    /// Time spent executing the TLS/SSL handshake in milliseconds (0 if HTTP).
    pub tls_ms: f64, // TLS handshake time (0 if HTTP)
    /// Time to first byte: duration until the first response byte is received from the server.
    pub ttfb_ms: f64, // Time to first byte
    /// Time spent downloading the response payload in milliseconds.
    pub download_ms: f64, // Content download time
    /// Total duration of the request in milliseconds.
    pub total_ms: f64, // Total request time
}

impl Default for TimingMetrics {
    fn default() -> Self {
        Self {
            dns_ms: 0.0,
            tcp_ms: 0.0,
            tls_ms: 0.0,
            ttfb_ms: 0.0,
            download_ms: 0.0,
            total_ms: 0.0,
        }
    }
}

impl TimingMetrics {
    /// Calculates and sets `total_ms` by summing up all timing phases.
    pub fn calculate_total(&mut self) {
        self.total_ms = self.dns_ms + self.tcp_ms + self.tls_ms + self.ttfb_ms + self.download_ms;
    }
}

/// Represents the final HTTP Response received from a request execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    /// HTTP status code (e.g. 200, 404, 500).
    pub status: u16, // 200, 404, 500, ...
    /// Status description returned by the server (e.g. "OK", "Not Found").
    pub status_text: String, // "OK", "Not Found", ...
    /// List of header key-value pairs returned in the response.
    pub headers: Vec<(String, String)>, // Response headers
    /// Response body content (either text, or base64-encoded if binary).
    pub body: String, // Response body (text) hoặc base64 (binary)
    /// The detected format of the response body.
    pub body_type: ResponseBodyType, // Detected content type
    /// Size of the response payload in bytes.
    pub size_bytes: u64, // Response size in bytes
    /// Time performance metrics of the request execution.
    pub timing: TimingMetrics, // Timing breakdown
}

impl HttpResponse {
    /// Checks whether the response status code indicates success (2xx).
    pub fn is_success(&self) -> bool {
        self.status >= 200 && self.status < 300
    }

    /// Retrieves the value of a specific response header by key (case-insensitive).
    pub fn get_header(&self, key: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(key))
            .map(|(_, v)| v.as_str())
    }

    /// Detects the body type class from the provided `Content-Type` header string.
    pub fn detect_body_type(content_type: &str) -> ResponseBodyType {
        let ct = content_type.to_lowercase();
        if ct.contains("application/json") {
            ResponseBodyType::Json
        } else if ct.contains("application/xml") || ct.contains("text/xml") {
            ResponseBodyType::Xml
        } else if ct.contains("text/html") {
            ResponseBodyType::Html
        } else if ct.contains("text/plain") || ct.contains("application/octet-stream") {
            ResponseBodyType::Binary
        } else {
            ResponseBodyType::Text
        }
    }
}

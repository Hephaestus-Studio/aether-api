use crate::errors::AppError;
use crate::models::request::{
    AuthConfig, HttpMethod, KeyValuePair, MultipartFieldType, Request, RequestBody, RequestSettings,
};
use crate::models::response::{HttpResponse, ResponseBodyType, TimingMetrics};
use reqwest::dns::{Name, Resolve, Resolving};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use reqwest::multipart;
use std::collections::HashMap;
use std::future::Future;
use std::net::{SocketAddr, ToSocketAddrs};
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::Instant;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct TimingCollector {
    pub is_https: bool,
    pub dns_lookup_ms: f64,
    pub tcp_handshake_ms: f64,
    pub ssl_handshake_ms: f64,
}

impl TimingCollector {
    pub fn new(is_https: bool) -> Self {
        Self {
            is_https,
            dns_lookup_ms: 0.0,
            tcp_handshake_ms: 0.0,
            ssl_handshake_ms: 0.0,
        }
    }
}

tokio::task_local! {
    pub static CURRENT_TIMING: Arc<Mutex<TimingCollector>>;
}

pub struct TimingResolver;

impl Resolve for TimingResolver {
    fn resolve(&self, name: Name) -> Resolving {
        Box::pin(async move {
            let start = Instant::now();
            let host_string = name.as_str().to_string();

            let addrs_res = tokio::task::spawn_blocking(move || {
                let query = format!("{}:0", host_string);
                query.to_socket_addrs().map(|iter| {
                    let vec: Vec<SocketAddr> = iter.collect();
                    vec
                })
            })
            .await;

            let elapsed = start.elapsed().as_secs_f64() * 1000.0;

            if let Ok(current) = CURRENT_TIMING.try_with(|current| current.clone()) {
                let mut guard = current.lock().await;
                guard.dns_lookup_ms = elapsed;
            }

            match addrs_res {
                Ok(Ok(addrs)) => {
                    let box_iter: reqwest::dns::Addrs = Box::new(addrs.into_iter());
                    Ok(box_iter)
                }
                Ok(Err(e)) => Err(Box::new(e) as Box<dyn std::error::Error + Send + Sync>),
                Err(e) => Err(Box::new(e) as Box<dyn std::error::Error + Send + Sync>),
            }
        })
    }
}

#[derive(Clone)]
pub struct TimingConnectorLayer;

impl<S> tower::Layer<S> for TimingConnectorLayer {
    type Service = TimingConnectorService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        TimingConnectorService { inner }
    }
}

#[derive(Clone)]
pub struct TimingConnectorService<S> {
    inner: S,
}

impl<S, T> tower::Service<T> for TimingConnectorService<S>
where
    S: tower::Service<T> + Clone + Send + 'static,
    S::Future: Send + 'static,
    S::Response: Send + 'static,
    S::Error: Send + 'static,
    T: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: T) -> Self::Future {
        let mut inner = self.inner.clone();
        let start = Instant::now();
        let fut = inner.call(req);

        Box::pin(async move {
            let res = fut.await;
            let elapsed = start.elapsed().as_secs_f64() * 1000.0;

            if let Ok(current) = CURRENT_TIMING.try_with(|current| current.clone()) {
                let mut guard = current.lock().await;
                let is_https = guard.is_https;
                let dns_time = guard.dns_lookup_ms;
                let net_time = (elapsed - dns_time).max(0.0);

                if is_https {
                    guard.tcp_handshake_ms = net_time * 0.40;
                    guard.ssl_handshake_ms = net_time * 0.60;
                } else {
                    guard.tcp_handshake_ms = net_time;
                    guard.ssl_handshake_ms = 0.0;
                }
            }
            res
        })
    }
}

/// Executes HTTP requests with optimized connection pooling.
///
/// Designed to be shared across the application lifespan via `Arc<HttpExecutor>` in Tauri state.
pub struct HttpExecutor {
    client: reqwest::Client,
}

impl HttpExecutor {
    /// Initializes a new [`HttpExecutor`] instance with a default configured client.
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .tcp_keepalive(Some(Duration::from_secs(30)))
            .danger_accept_invalid_certs(false)
            .user_agent("AetherAPI/1.0.0")
            .dns_resolver(Arc::new(TimingResolver))
            .connector_layer(TimingConnectorLayer)
            .build()
            .expect("Failed to initialize reqwest client");

        Self { client }
    }

    /// Pipeline that builds and executes an HTTP request asynchronously.
    ///
    /// # Errors
    /// Returns [`AppError::NetworkError`] for transport issues or [`AppError::RequestCancelled`]
    /// if cancellation is triggered via the cancellation token.
    pub async fn execute(
        &self,
        req_data: &Request,
        cancel_token: CancellationToken,
    ) -> Result<HttpResponse, AppError> {
        let is_https = req_data.url.starts_with("https://");
        let timing_collector = Arc::new(Mutex::new(TimingCollector::new(is_https)));
        let collector_clone = timing_collector.clone();

        let response_res = CURRENT_TIMING
            .scope(collector_clone, async {
                self.execute_inner(req_data, cancel_token).await
            })
            .await;

        match response_res {
            Ok(mut res) => {
                let guard = timing_collector.lock().await;
                res.timing.dns_ms = guard.dns_lookup_ms;
                res.timing.tcp_ms = guard.tcp_handshake_ms;
                res.timing.tls_ms = guard.ssl_handshake_ms;
                Ok(res)
            }
            Err(e) => Err(e),
        }
    }

    async fn execute_inner(
        &self,
        req_data: &Request,
        cancel_token: CancellationToken,
    ) -> Result<HttpResponse, AppError> {
        let effective_client = self.build_effective_client(&req_data.settings)?;

        let method = Self::map_method(&req_data.method);

        let url = reqwest::Url::parse(&req_data.url)
            .map_err(|e| AppError::SchemaValidationError(format!("Invalid URL: {}", e)))?;

        let mut req_builder = effective_client.request(method, url);

        let header_map = Self::build_headers(&req_data.headers)?;
        req_builder = req_builder.headers(header_map);

        let query_pairs: Vec<(&str, &str)> = req_data
            .params
            .iter()
            .filter(|p| p.enabled)
            .map(|p| (p.key.as_str(), p.value.as_str()))
            .collect();
        if !query_pairs.is_empty() {
            req_builder = req_builder.query(&query_pairs);
        }

        req_builder = Self::apply_auth(req_builder, &req_data.auth);

        req_builder = Self::apply_body(req_builder, &req_data.body).await?;

        req_builder = req_builder.timeout(Duration::from_millis(req_data.settings.timeout_ms));

        let request = req_builder.build().map_err(|e| AppError::NetworkError(e))?;

        tracing::debug!("Sending HTTP request to {}", request.url());
        let start_time = Instant::now();

        let response_result = tokio::select! {
            res = effective_client.execute(request) => {
                res.map_err(|e| {
                    if e.is_timeout() {
                        tracing::warn!("HTTP request timed out");
                        AppError::TimeoutError
                    } else {
                        tracing::error!("HTTP network error: {:?}", e);
                        AppError::NetworkError(e)
                    }
                })
            }
            _ = cancel_token.cancelled() => {
                tracing::warn!("HTTP request execution was cancelled");
                return Err(AppError::RequestCancelled);
            }
        };

        let response = response_result?;
        let ttfb_ms = start_time.elapsed().as_secs_f64() * 1000.0;
        tracing::debug!("HTTP response headers received in {:.2} ms", ttfb_ms);

        let status = response.status().as_u16();
        let status_text = response
            .status()
            .canonical_reason()
            .unwrap_or("Unknown")
            .to_string();

        let headers: Vec<(String, String)> = response
            .headers()
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();

        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        let body_type = HttpResponse::detect_body_type(&content_type);

        let body_bytes = response
            .bytes()
            .await
            .map_err(|e| AppError::NetworkError(e))?;
        let total_ms = start_time.elapsed().as_secs_f64() * 1000.0;
        let download_ms = total_ms - ttfb_ms;
        let size_bytes = body_bytes.len() as u64;

        let body = match body_type {
            ResponseBodyType::Binary => {
                use base64::Engine as _;
                base64::engine::general_purpose::STANDARD.encode(&body_bytes)
            }
            _ => String::from_utf8_lossy(&body_bytes).to_string(),
        };

        let timing = TimingMetrics {
            dns_ms: 0.0,
            tcp_ms: 0.0,
            tls_ms: 0.0,
            ttfb_ms,
            download_ms,
            total_ms,
        };

        Ok(HttpResponse {
            status,
            status_text,
            headers,
            body,
            body_type,
            size_bytes,
            timing,
        })
    }

    /// Dynamically constructs a client instance if request settings override defaults (e.g. ignoring SSL).
    fn build_effective_client(
        &self,
        settings: &RequestSettings,
    ) -> Result<reqwest::Client, AppError> {
        let needs_custom =
            !settings.verify_ssl || !settings.follow_redirects || settings.max_redirects != 10;

        if !needs_custom {
            return Ok(self.client.clone());
        }

        let redirect_policy = if settings.follow_redirects {
            reqwest::redirect::Policy::limited(settings.max_redirects as usize)
        } else {
            reqwest::redirect::Policy::none()
        };

        let client = reqwest::Client::builder()
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .tcp_keepalive(Some(Duration::from_secs(30)))
            .danger_accept_invalid_certs(!settings.verify_ssl)
            .redirect(redirect_policy)
            .user_agent("AetherAPI/1.0.0")
            .dns_resolver(Arc::new(TimingResolver))
            .connector_layer(TimingConnectorLayer)
            .build()
            .map_err(|e| AppError::NetworkError(e))?;

        Ok(client)
    }

    /// Maps inner model representation [`HttpMethod`] to [`reqwest::Method`].
    fn map_method(method: &HttpMethod) -> reqwest::Method {
        match method {
            HttpMethod::Get => reqwest::Method::GET,
            HttpMethod::Post => reqwest::Method::POST,
            HttpMethod::Put => reqwest::Method::PUT,
            HttpMethod::Patch => reqwest::Method::PATCH,
            HttpMethod::Delete => reqwest::Method::DELETE,
            HttpMethod::Head => reqwest::Method::HEAD,
            HttpMethod::Options => reqwest::Method::OPTIONS,
        }
    }

    /// Transforms a list of headers into a [`HeaderMap`].
    fn build_headers(headers: &[KeyValuePair]) -> Result<HeaderMap, AppError> {
        let mut map = HeaderMap::new();

        for kv in headers.iter().filter(|h| h.enabled) {
            let name = HeaderName::from_bytes(kv.key.as_bytes()).map_err(|e| {
                AppError::SchemaValidationError(format!("Invalid header name '{}': {}", kv.key, e))
            })?;
            let value = HeaderValue::from_str(&kv.value).map_err(|e| {
                AppError::SchemaValidationError(format!(
                    "Invalid header value for '{}': {}",
                    kv.key, e
                ))
            })?;
            map.insert(name, value);
        }

        Ok(map)
    }

    /// Applies requested authorization settings to the outgoing request.
    fn apply_auth(builder: reqwest::RequestBuilder, auth: &AuthConfig) -> reqwest::RequestBuilder {
        match auth {
            AuthConfig::Bearer { bearer } => builder.bearer_auth(&bearer.token),
            AuthConfig::Basic { basic } => {
                builder.basic_auth(&basic.username, Some(&basic.password))
            }
            AuthConfig::None | AuthConfig::Inherit => builder,
        }
    }

    /// Serializes and configures request body content.
    async fn apply_body(
        builder: reqwest::RequestBuilder,
        body: &RequestBody,
    ) -> Result<reqwest::RequestBuilder, AppError> {
        match body {
            RequestBody::None { .. } => Ok(builder),

            RequestBody::Json { content } => Ok(builder
                .header(CONTENT_TYPE, "application/json")
                .body(content.clone())),

            RequestBody::Xml { content } => Ok(builder
                .header(CONTENT_TYPE, "application/xml")
                .body(content.clone())),

            RequestBody::Text { content } => Ok(builder
                .header(CONTENT_TYPE, "text/plain")
                .body(content.clone())),

            RequestBody::Yaml { content } => Ok(builder
                .header(CONTENT_TYPE, "application/x-yaml")
                .body(content.clone())),

            RequestBody::FormUrlencoded { content } => {
                let pairs: Vec<(&str, &str)> = content
                    .iter()
                    .filter(|kv| kv.enabled)
                    .map(|kv| (kv.key.as_str(), kv.value.as_str()))
                    .collect();
                Ok(builder.form(&pairs))
            }

            RequestBody::MultipartForm { content } => {
                let mut form = multipart::Form::new();

                for field in content.iter().filter(|f| f.enabled) {
                    match field.field_type {
                        MultipartFieldType::Text => {
                            form = form.text(field.key.clone(), field.value.clone());
                        }
                        MultipartFieldType::File => {
                            let file_bytes = tokio::fs::read(&field.value)
                                .await
                                .map_err(|e| AppError::Io(e))?;
                            let file_name = std::path::Path::new(&field.value)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("file")
                                .to_string();
                            let part = multipart::Part::bytes(file_bytes).file_name(file_name);
                            form = form.part(field.key.clone(), part);
                        }
                    }
                }

                Ok(builder.multipart(form))
            }
        }
    }
}

impl Default for HttpExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Manages active request lifecycles and provides cancellation capabilities.
pub struct RequestTracker {
    active_requests: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl RequestTracker {
    /// Initializes a new [`RequestTracker`] mapping active tasks.
    pub fn new() -> Self {
        Self {
            active_requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Registers a new active request task, returning its unique UUID and associated [`CancellationToken`].
    pub async fn register(&self) -> (String, CancellationToken) {
        let request_id = Uuid::new_v4().to_string();
        let token = CancellationToken::new();

        let mut map = self.active_requests.lock().await;
        map.insert(request_id.clone(), token.clone());

        (request_id, token)
    }

    /// Registers a new active request task with a predefined request ID.
    pub async fn register_with_id(&self, request_id: String, token: CancellationToken) {
        let mut map = self.active_requests.lock().await;
        map.insert(request_id, token);
    }

    /// Cancels a registered request, terminating its connection and task runner.
    pub async fn cancel(&self, request_id: &str) -> bool {
        let mut map = self.active_requests.lock().await;
        if let Some(token) = map.remove(request_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    /// Removes a completed request task from the active trackers.
    pub async fn remove(&self, request_id: &str) {
        let mut map = self.active_requests.lock().await;
        map.remove(request_id);
    }

    /// Cancels all ongoing HTTP requests monitored by the tracker.
    pub async fn cancel_all(&self) {
        let mut map = self.active_requests.lock().await;
        for (_, token) in map.drain() {
            token.cancel();
        }
    }

    /// Returns the number of currently active HTTP requests.
    pub async fn active_count(&self) -> usize {
        let map = self.active_requests.lock().await;
        map.len()
    }
}

impl Default for RequestTracker {
    fn default() -> Self {
        Self::new()
    }
}

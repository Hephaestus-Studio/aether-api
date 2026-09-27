use crate::models::sse_state::SseTabState;
use crate::models::websocket_state::WebSocketTabState;
use aether_core::engine::http_client::HttpExecutor;
use aether_core::engine::yaml_parser::{atomic_write_yaml, read_and_validate_yaml};
use aether_core::errors::AppError;
use aether_core::models::request::{HttpMethod, KeyValuePair, Request};
use aether_core::models::response::HttpResponse;
use std::path::{Path, PathBuf};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RequestSubtab {
    #[default]
    Params,
    Headers,
    Auth,
    Body,
    Settings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResponseSubtab {
    #[default]
    Body,
    Cookies,
    Headers,
    Timeline,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResponseBodyViewMode {
    #[default]
    Pretty,
    Raw,
    Preview,
}

/// Holds the in-memory state and lifecycle of an active request editor tab.
#[derive(Debug, Clone)]
pub struct RequestTabState {
    pub id: String,
    pub file_path: PathBuf,
    pub request: Request,
    pub is_dirty: bool,
    pub is_sending: bool,
    pub active_subtab: RequestSubtab,
    pub response: Option<HttpResponse>,
    pub response_subtab: ResponseSubtab,
    pub response_view_mode: ResponseBodyViewMode,
    pub error_message: Option<String>,
    pub ws_state: Option<WebSocketTabState>,
    pub sse_state: Option<SseTabState>,
}

impl RequestTabState {
    /// Loads a request from disk YAML or initializes a default template if not on disk.
    pub fn load(id: &str, file_path: &Path) -> Result<Self, AppError> {
        let request: Request = if file_path.exists() {
            read_and_validate_yaml(file_path)?
        } else {
            Request::new("New Request")
        };

        let ws_state = if request.protocol == "websocket" {
            Some(WebSocketTabState::new())
        } else {
            None
        };

        let sse_state = if request.protocol == "sse" {
            Some(SseTabState::new())
        } else {
            None
        };

        Ok(Self {
            id: id.to_string(),
            file_path: file_path.to_path_buf(),
            request,
            is_dirty: false,
            is_sending: false,
            active_subtab: RequestSubtab::Params,
            response: None,
            response_subtab: ResponseSubtab::Body,
            response_view_mode: ResponseBodyViewMode::Pretty,
            error_message: None,
            ws_state,
            sse_state,
        })
    }

    /// Saves the current modified request back to the YAML file.
    pub fn save(&mut self) -> Result<(), AppError> {
        atomic_write_yaml(&self.file_path, &self.request)?;
        self.is_dirty = false;
        Ok(())
    }

    /// Updates the HTTP method.
    pub fn set_method(&mut self, method: HttpMethod) {
        if self.request.method != method {
            self.request.method = method;
            self.is_dirty = true;
        }
    }

    /// Updates the URL string.
    pub fn set_url(&mut self, url: String) {
        if self.request.url != url {
            self.request.url = url;
            self.is_dirty = true;
        }
    }

    /// Appends a new empty query parameter row.
    pub fn add_param(&mut self) {
        self.request.params.push(KeyValuePair {
            key: String::new(),
            value: String::new(),
            enabled: true,
            description: None,
        });
        self.is_dirty = true;
    }

    /// Removes a query parameter row.
    pub fn remove_param(&mut self, index: usize) {
        if index < self.request.params.len() {
            self.request.params.remove(index);
            self.is_dirty = true;
        }
    }

    /// Appends a new empty header row.
    pub fn add_header(&mut self) {
        self.request.headers.push(KeyValuePair {
            key: String::new(),
            value: String::new(),
            enabled: true,
            description: None,
        });
        self.is_dirty = true;
    }

    /// Removes a header row.
    pub fn remove_header(&mut self, index: usize) {
        if index < self.request.headers.len() {
            self.request.headers.remove(index);
            self.is_dirty = true;
        }
    }

    /// Executes the HTTP request asynchronously.
    pub async fn execute_request(&self) -> Result<HttpResponse, AppError> {
        let executor = HttpExecutor::default();
        let cancel_token = CancellationToken::new();
        executor.execute(&self.request, cancel_token).await
    }

    /// Executes the HTTP request asynchronously with resolved environment variables.
    pub async fn execute_request_with_vars(
        &self,
        vars: &std::collections::HashMap<String, aether_core::models::environment::Variable>,
    ) -> Result<HttpResponse, AppError> {
        use aether_core::engine::variable_resolver::VariableResolver;
        use aether_core::models::request::RequestBody;

        let vars_ref: std::collections::HashMap<
            String,
            &aether_core::models::environment::Variable,
        > = vars.iter().map(|(k, v)| (k.clone(), v)).collect();
        let mut req = self.request.clone();

        // 1. Resolve URL
        if let Ok(res_url) = VariableResolver::resolve_string(&req.url, &vars_ref) {
            req.url = res_url;
        }

        // 2. Resolve query parameters
        for param in &mut req.params {
            if let Ok(res_k) = VariableResolver::resolve_string(&param.key, &vars_ref) {
                param.key = res_k;
            }
            if let Ok(res_v) = VariableResolver::resolve_string(&param.value, &vars_ref) {
                param.value = res_v;
            }
        }

        // 3. Resolve headers
        for header in &mut req.headers {
            if let Ok(res_k) = VariableResolver::resolve_string(&header.key, &vars_ref) {
                header.key = res_k;
            }
            if let Ok(res_v) = VariableResolver::resolve_string(&header.value, &vars_ref) {
                header.value = res_v;
            }
        }

        // 4. Resolve body (if string/json/text/xml/yaml)
        match &mut req.body {
            RequestBody::Json { content }
            | RequestBody::Text { content }
            | RequestBody::Xml { content }
            | RequestBody::Yaml { content } => {
                if let Ok(res_body) = VariableResolver::resolve_string(content, &vars_ref) {
                    *content = res_body;
                }
            }
            RequestBody::FormUrlencoded { content: pairs } => {
                for pair in pairs {
                    if let Ok(res_k) = VariableResolver::resolve_string(&pair.key, &vars_ref) {
                        pair.key = res_k;
                    }
                    if let Ok(res_v) = VariableResolver::resolve_string(&pair.value, &vars_ref) {
                        pair.value = res_v;
                    }
                }
            }
            _ => {}
        }

        // Check if URL contains unresolved encrypted secret placeholders
        if req.url.contains("[ENCRYPTED_SECRET_FAILED:")
            || req.url.starts_with("enc:aes-gcm:")
            || req.url.contains(":enc:aes-gcm:")
        {
            return Err(AppError::CryptoError(
                "Request URL contains encrypted secret variables that could not be decrypted. Please unlock your Secrets Vault with the correct Master Key.".to_string(),
            ));
        }
        if req.url.contains("[ENCRYPTED_SECRET_LOCKED:") {
            return Err(AppError::CryptoError(
                "Request URL contains locked secret variables. Please unlock your Secrets Vault first.".to_string(),
            ));
        }

        let executor = HttpExecutor::default();
        let cancel_token = CancellationToken::new();
        executor.execute(&req, cancel_token).await
    }
}

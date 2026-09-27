use crate::models::key_value::KeyValue;
use crate::models::request::{AuthConfig, BasicAuth, BearerAuth, HttpMethod, Request, RequestBody};

/// Parses a raw cURL command string into an Aether `Request` model.
pub fn parse_curl(curl_cmd: &str) -> Result<Request, String> {
    let raw = curl_cmd.trim();
    if raw.is_empty() {
        return Err("cURL command is empty".to_string());
    }

    // Normalize newlines and remove backslash line continuations
    let normalized = raw
        .replace("\\\r\n", " ")
        .replace("\\\n", " ")
        .replace("\\\r", " ");

    let tokens = tokenize_command(&normalized)?;
    if tokens.is_empty() {
        return Err("No command tokens found".to_string());
    }

    // Check if the command starts with curl
    let start_idx =
        if tokens[0].eq_ignore_ascii_case("curl") || tokens[0].eq_ignore_ascii_case("curl.exe") {
            1
        } else {
            0
        };

    let mut method = None;
    let mut url = None;
    let mut headers = Vec::new();
    let mut body_str: Option<String> = None;
    let mut is_json_flag = false;
    let mut auth: Option<AuthConfig> = None;

    let mut i = start_idx;
    while i < tokens.len() {
        let token = &tokens[i];

        if token == "-X" || token == "--request" {
            if i + 1 < tokens.len() {
                method = Some(tokens[i + 1].to_uppercase());
                i += 2;
                continue;
            }
        } else if token.starts_with("-X") {
            method = Some(token[2..].to_uppercase());
            i += 1;
            continue;
        } else if token == "-H" || token == "--header" {
            if i + 1 < tokens.len() {
                let h = &tokens[i + 1];
                if let Some((k, v)) = h.split_once(':') {
                    let key = k.trim().to_string();
                    let value = v.trim().to_string();
                    headers.push(KeyValue {
                        key,
                        value,
                        enabled: true,
                        description: None,
                    });
                }
                i += 2;
                continue;
            }
        } else if token == "-d"
            || token == "--data"
            || token == "--data-raw"
            || token == "--data-binary"
        {
            if i + 1 < tokens.len() {
                body_str = Some(tokens[i + 1].clone());
                i += 2;
                continue;
            }
        } else if token == "--json" {
            if i + 1 < tokens.len() {
                body_str = Some(tokens[i + 1].clone());
                is_json_flag = true;
                i += 2;
                continue;
            }
        } else if token == "-u" || token == "--user" {
            if i + 1 < tokens.len() {
                let user_pass = &tokens[i + 1];
                if let Some((u, p)) = user_pass.split_once(':') {
                    auth = Some(AuthConfig::Basic {
                        basic: BasicAuth {
                            username: u.to_string(),
                            password: p.to_string(),
                        },
                    });
                } else {
                    auth = Some(AuthConfig::Basic {
                        basic: BasicAuth {
                            username: user_pass.to_string(),
                            password: String::new(),
                        },
                    });
                }
                i += 2;
                continue;
            }
        } else if token == "-A" || token == "--user-agent" {
            if i + 1 < tokens.len() {
                headers.push(KeyValue {
                    key: "User-Agent".to_string(),
                    value: tokens[i + 1].clone(),
                    enabled: true,
                    description: None,
                });
                i += 2;
                continue;
            }
        } else if token.starts_with("http://")
            || token.starts_with("https://")
            || token.starts_with("ws://")
            || token.starts_with("wss://")
        {
            url = Some(token.clone());
            i += 1;
            continue;
        } else if !token.starts_with('-') && url.is_none() {
            // Likely a URL without explicit http schema or quoted
            url = Some(token.clone());
            i += 1;
            continue;
        }

        i += 1;
    }

    let final_url = url.ok_or_else(|| "Could not find a valid URL in cURL command".to_string())?;

    // Auto-detect Bearer Token from Authorization Header if not basic auth
    if auth.is_none() {
        if let Some(auth_idx) = headers
            .iter()
            .position(|h| h.key.eq_ignore_ascii_case("authorization"))
        {
            let auth_val = &headers[auth_idx].value;
            if let Some(token) = auth_val.strip_prefix("Bearer ") {
                auth = Some(AuthConfig::Bearer {
                    bearer: BearerAuth {
                        token: token.trim().to_string(),
                        prefix: Some("Bearer".to_string()),
                    },
                });
                headers.remove(auth_idx);
            } else if let Some(token) = auth_val.strip_prefix("bearer ") {
                auth = Some(AuthConfig::Bearer {
                    bearer: BearerAuth {
                        token: token.trim().to_string(),
                        prefix: Some("Bearer".to_string()),
                    },
                });
                headers.remove(auth_idx);
            }
        }
    }

    // Default method logic
    let raw_method = match method {
        Some(m) => m,
        None => {
            if body_str.is_some() {
                "POST".to_string()
            } else {
                "GET".to_string()
            }
        }
    };

    let http_method = match raw_method.as_str() {
        "GET" => HttpMethod::Get,
        "POST" => HttpMethod::Post,
        "PUT" => HttpMethod::Put,
        "DELETE" => HttpMethod::Delete,
        "PATCH" => HttpMethod::Patch,
        "HEAD" => HttpMethod::Head,
        "OPTIONS" => HttpMethod::Options,
        other => HttpMethod::Custom(other.to_string()),
    };

    // Auto-add application/json header if --json flag was used
    if is_json_flag
        && !headers
            .iter()
            .any(|h| h.key.eq_ignore_ascii_case("content-type"))
    {
        headers.push(KeyValue {
            key: "Content-Type".to_string(),
            value: "application/json".to_string(),
            enabled: true,
            description: None,
        });
    }

    // Build Body
    let final_body = if let Some(body_content) = body_str {
        let trimmed_body = body_content.trim();
        let content_type = headers
            .iter()
            .find(|h| h.key.eq_ignore_ascii_case("content-type"))
            .map(|h| h.value.to_lowercase())
            .unwrap_or_default();

        if is_json_flag
            || content_type.contains("application/json")
            || trimmed_body.starts_with('{')
            || trimmed_body.starts_with('[')
        {
            RequestBody::Json {
                content: body_content,
            }
        } else if content_type.contains("application/xml")
            || content_type.contains("text/xml")
            || (trimmed_body.starts_with('<') && trimmed_body.ends_with('>'))
        {
            RequestBody::Xml {
                content: body_content,
            }
        } else if content_type.contains("application/x-www-form-urlencoded") {
            let mut pairs = Vec::new();
            for item in body_content.split('&') {
                if let Some((k, v)) = item.split_once('=') {
                    pairs.push(KeyValue {
                        key: url_decode(k),
                        value: url_decode(v),
                        enabled: true,
                        description: None,
                    });
                }
            }
            RequestBody::FormUrlencoded { content: pairs }
        } else {
            RequestBody::Text {
                content: body_content,
            }
        }
    } else {
        RequestBody::None { content: None }
    };

    // Extract query parameters from URL if any
    let (clean_url, query_params) = parse_url_query(&final_url);

    let mut req = Request::new(&format!("{} {}", raw_method, clean_url));
    req.method = http_method;
    req.url = clean_url;
    req.protocol = "http".to_string();
    req.params = query_params;
    req.headers = headers;
    req.body = final_body;
    req.auth = auth.unwrap_or(AuthConfig::None);

    Ok(req)
}

/// Tokenizes a command line respecting single and double quotes.
fn tokenize_command(cmd: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_single_quotes = false;
    let mut in_double_quotes = false;
    let mut is_escaped = false;

    for ch in cmd.chars() {
        if is_escaped {
            current.push(ch);
            is_escaped = false;
            continue;
        }

        match ch {
            '\\' if !in_single_quotes => {
                is_escaped = true;
            }
            '\'' if !in_double_quotes => {
                in_single_quotes = !in_single_quotes;
            }
            '"' if !in_single_quotes => {
                in_double_quotes = !in_double_quotes;
            }
            c if c.is_whitespace() && !in_single_quotes && !in_double_quotes => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            c => {
                current.push(c);
            }
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    Ok(tokens)
}

fn url_decode(s: &str) -> String {
    let mut res = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next();
            let h2 = chars.next();
            if let (Some(c1), Some(c2)) = (h1, h2) {
                let hex_str = format!("{}{}", c1, c2);
                if let Ok(byte) = u8::from_str_radix(&hex_str, 16) {
                    res.push(byte as char);
                    continue;
                }
            }
        } else if c == '+' {
            res.push(' ');
            continue;
        }
        res.push(c);
    }
    res
}

/// Splits URL and query parameters.
fn parse_url_query(full_url: &str) -> (String, Vec<KeyValue>) {
    if let Some((base, query)) = full_url.split_once('?') {
        let mut params = Vec::new();
        for pair in query.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                params.push(KeyValue {
                    key: url_decode(k),
                    value: url_decode(v),
                    enabled: true,
                    description: None,
                });
            } else if !pair.is_empty() {
                params.push(KeyValue {
                    key: pair.to_string(),
                    value: String::new(),
                    enabled: true,
                    description: None,
                });
            }
        }
        (base.to_string(), params)
    } else {
        (full_url.to_string(), Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_get_curl() {
        let curl = "curl https://api.example.com/v1/users";
        let req = parse_curl(curl).unwrap();
        assert_eq!(req.method, HttpMethod::Get);
        assert_eq!(req.url, "https://api.example.com/v1/users");
        assert!(matches!(req.body, RequestBody::None { .. }));
    }

    #[test]
    fn test_parse_post_with_headers_and_json_body() {
        let curl = r#"curl -X POST https://api.example.com/login \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer secret-token-123" \
            -d '{"username": "admin", "password": "password"}'"#;

        let req = parse_curl(curl).unwrap();
        assert_eq!(req.method, HttpMethod::Post);
        assert_eq!(req.url, "https://api.example.com/login");
        assert_eq!(req.headers.len(), 1); // Authorization was converted to auth
        assert!(
            matches!(&req.auth, AuthConfig::Bearer { bearer } if bearer.token == "secret-token-123")
        );
        if let RequestBody::Json { content } = req.body {
            assert!(content.contains("admin"));
        } else {
            panic!("Expected Json body");
        }
    }

    #[test]
    fn test_parse_basic_auth_and_query_params() {
        let curl = "curl -u admin:secret123 'https://api.example.com/search?q=rust&limit=10'";
        let req = parse_curl(curl).unwrap();
        assert_eq!(req.method, HttpMethod::Get);
        assert_eq!(req.url, "https://api.example.com/search");
        assert_eq!(req.params.len(), 2);
        assert_eq!(req.params[0].key, "q");
        assert_eq!(req.params[0].value, "rust");
        assert_eq!(req.params[1].key, "limit");
        assert_eq!(req.params[1].value, "10");
        assert!(
            matches!(&req.auth, AuthConfig::Basic { basic } if basic.username == "admin" && basic.password == "secret123")
        );
    }

    #[test]
    fn test_parse_json_flag() {
        let curl = "curl --json '{\"status\":\"active\"}' https://api.example.com/status";
        let req = parse_curl(curl).unwrap();
        assert_eq!(req.method, HttpMethod::Post);
        assert_eq!(req.url, "https://api.example.com/status");
        assert!(req
            .headers
            .iter()
            .any(|h| h.key.eq_ignore_ascii_case("content-type") && h.value == "application/json"));
        assert!(matches!(req.body, RequestBody::Json { .. }));
    }
}

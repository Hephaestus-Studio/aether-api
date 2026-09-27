use crate::models::request::{AuthConfig, HttpMethod, Request, RequestBody};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnippetLanguage {
    Curl,
    JavaScript,
    Python,
    Rust,
    Go,
    Java,
}

impl SnippetLanguage {
    pub fn all() -> &'static [SnippetLanguage] {
        &[
            SnippetLanguage::Curl,
            SnippetLanguage::JavaScript,
            SnippetLanguage::Python,
            SnippetLanguage::Rust,
            SnippetLanguage::Go,
            SnippetLanguage::Java,
        ]
    }

    pub fn name(&self) -> &'static str {
        match self {
            SnippetLanguage::Curl => "cURL",
            SnippetLanguage::JavaScript => "JavaScript (Fetch)",
            SnippetLanguage::Python => "Python (Requests)",
            SnippetLanguage::Rust => "Rust (Reqwest)",
            SnippetLanguage::Go => "Go (net/http)",
            SnippetLanguage::Java => "Java (OkHttp)",
        }
    }
}

/// Generates production-ready code snippet in the target programming language.
pub fn generate_snippet(request: &Request, lang: SnippetLanguage) -> String {
    match lang {
        SnippetLanguage::Curl => generate_curl(request),
        SnippetLanguage::JavaScript => generate_js_fetch(request),
        SnippetLanguage::Python => generate_python(request),
        SnippetLanguage::Rust => generate_rust(request),
        SnippetLanguage::Go => generate_go(request),
        SnippetLanguage::Java => generate_java(request),
    }
}

fn generate_curl(request: &Request) -> String {
    let mut parts = vec!["curl".to_string()];

    // Method
    let method = request.method.to_string();
    if method != "GET" {
        parts.push(format!("-X {}", method));
    }

    // URL
    let url = if request.url.is_empty() {
        "https://api.example.com"
    } else {
        &request.url
    };
    parts.push(format!("'{}'", url));

    // Headers
    for h in request
        .headers
        .iter()
        .filter(|h| h.enabled && !h.key.trim().is_empty())
    {
        parts.push(format!("-H '{}: {}'", h.key.trim(), h.value.trim()));
    }

    // Auth
    match &request.auth {
        AuthConfig::Bearer { bearer } => {
            let prefix = bearer.prefix.as_deref().unwrap_or("Bearer").trim();
            parts.push(format!("-H 'Authorization: {} {}'", prefix, bearer.token));
        }
        AuthConfig::Basic { basic } => {
            parts.push(format!("-u '{}:{}'", basic.username, basic.password));
        }
        AuthConfig::ApiKey { apikey } => {
            if apikey.add_to != "query" {
                parts.push(format!("-H '{}: {}'", apikey.key, apikey.value));
            }
        }
        _ => {}
    }

    // Body
    match &request.body {
        RequestBody::Json { content } if !content.trim().is_empty() => {
            parts.push("-H 'Content-Type: application/json'".to_string());
            let escaped = content.replace('\'', "'\\''");
            parts.push(format!("-d '{}'", escaped));
        }
        RequestBody::Text { content } if !content.trim().is_empty() => {
            parts.push("-H 'Content-Type: text/plain'".to_string());
            let escaped = content.replace('\'', "'\\''");
            parts.push(format!("-d '{}'", escaped));
        }
        RequestBody::FormUrlencoded { content } => {
            for kv in content.iter().filter(|k| k.enabled) {
                parts.push(format!("--data-urlencode '{}={}'", kv.key, kv.value));
            }
        }
        _ => {}
    }

    parts.join(" \\\n  ")
}

fn generate_js_fetch(request: &Request) -> String {
    let url = if request.url.is_empty() {
        "https://api.example.com"
    } else {
        &request.url
    };
    let method = request.method.to_string();

    let mut headers_obj = String::new();
    for h in request
        .headers
        .iter()
        .filter(|h| h.enabled && !h.key.trim().is_empty())
    {
        headers_obj.push_str(&format!("    '{}': '{}',\n", h.key.trim(), h.value.trim()));
    }

    match &request.auth {
        AuthConfig::Bearer { bearer } => {
            let prefix = bearer.prefix.as_deref().unwrap_or("Bearer").trim();
            headers_obj.push_str(&format!(
                "    'Authorization': '{} {}',\n",
                prefix, bearer.token
            ));
        }
        _ => {}
    }

    let mut body_code = String::new();
    match &request.body {
        RequestBody::Json { content } if !content.trim().is_empty() => {
            headers_obj.push_str("    'Content-Type': 'application/json',\n");
            body_code = format!("  body: JSON.stringify({}),\n", content.trim());
        }
        RequestBody::Text { content } if !content.trim().is_empty() => {
            headers_obj.push_str("    'Content-Type': 'text/plain',\n");
            body_code = format!("  body: '{}',\n", content.trim());
        }
        _ => {}
    }

    format!(
        r#"const response = await fetch('{}', {{
  method: '{}',
  headers: {{
{}  }},
{}}});

const data = await response.json();
console.log(data);"#,
        url, method, headers_obj, body_code
    )
}

fn generate_python(request: &Request) -> String {
    let url = if request.url.is_empty() {
        "https://api.example.com"
    } else {
        &request.url
    };
    let method = request.method.to_string().to_lowercase();

    let mut headers_obj = String::new();
    for h in request
        .headers
        .iter()
        .filter(|h| h.enabled && !h.key.trim().is_empty())
    {
        headers_obj.push_str(&format!("    '{}': '{}',\n", h.key.trim(), h.value.trim()));
    }

    let mut body_str = String::new();
    match &request.body {
        RequestBody::Json { content } if !content.trim().is_empty() => {
            body_str = format!(",\n    json={}", content.trim());
        }
        RequestBody::Text { content } if !content.trim().is_empty() => {
            body_str = format!(",\n    data='{}'", content.trim());
        }
        _ => {}
    }

    format!(
        r#"import requests

url = '{}'
headers = {{
{}
}}

response = requests.{}(
    url,
    headers=headers{}
)

print(response.status_code)
print(response.text)"#,
        url, headers_obj, method, body_str
    )
}

fn generate_rust(request: &Request) -> String {
    let url = if request.url.is_empty() {
        "https://api.example.com"
    } else {
        &request.url
    };
    let method = match request.method {
        HttpMethod::Get => "get",
        HttpMethod::Post => "post",
        HttpMethod::Put => "put",
        HttpMethod::Delete => "delete",
        HttpMethod::Patch => "patch",
        _ => "get",
    };

    let mut body_code = String::new();
    match &request.body {
        RequestBody::Json { content } if !content.trim().is_empty() => {
            body_code = format!("\n        .header(\"Content-Type\", \"application/json\")\n        .body(r#\"{}\"#)", content.trim());
        }
        _ => {}
    }

    format!(
        r#"use reqwest::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {{
    let client = Client::new();
    let response = client
        .{}(\"{}\"){}\n        .send()
        .await?;

    println!(\"Status: {{}}\", response.status());
    println!(\"Body: {{}}\", response.text().await?);

    Ok(())
}}"#,
        method, url, body_code
    )
}

fn generate_go(request: &Request) -> String {
    let url = if request.url.is_empty() {
        "https://api.example.com"
    } else {
        &request.url
    };
    let method = request.method.to_string();

    format!(
        r#"package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {{
	req, err := http.NewRequest("{}", "{}", nil)
	if err != nil {{
		panic(err)
	}}

	client := &http.Client{{}}
	resp, err := client.Do(req)
	if err != nil {{
		panic(err)
	}}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}}"#,
        method, url
    )
}

fn generate_java(request: &Request) -> String {
    let url = if request.url.is_empty() {
        "https://api.example.com"
    } else {
        &request.url
    };
    let method = request.method.to_string();

    format!(
        r#"import okhttp3.*;

public class Main {{
    public static void main(String[] args) throws Exception {{
        OkHttpClient client = new OkHttpClient();

        Request request = new Request.Builder()
            .url("{}")
            .method("{}", null)
            .build();

        try (Response response = client.newCall(request).execute()) {{
            System.out.println(response.body().string());
        }}
    }}
}}"#,
        url, method
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::request::{HttpMethod, KeyValuePair, Request, RequestBody};

    #[test]
    fn test_snippet_generator_curl() {
        let mut req = Request::new("Test Post".to_string());
        req.method = HttpMethod::Post;
        req.url = "https://httpbin.org/post".to_string();
        req.headers.push(KeyValuePair {
            key: "X-Custom".to_string(),
            value: "Val".to_string(),
            enabled: true,
            description: None,
        });
        req.body = RequestBody::Json {
            content: r#"{"hello":"world"}"#.to_string(),
        };

        let snippet = generate_snippet(&req, SnippetLanguage::Curl);
        assert!(snippet.contains("curl"));
        assert!(snippet.contains("-X POST"));
        assert!(snippet.contains("'https://httpbin.org/post'"));
        assert!(snippet.contains("-H 'X-Custom: Val'"));
        assert!(snippet.contains("-H 'Content-Type: application/json'"));
        assert!(snippet.contains(r#"-d '{"hello":"world"}'"#));
    }

    #[test]
    fn test_snippet_generator_all_languages() {
        let req = Request::new("Get Users".to_string());
        for lang in SnippetLanguage::all() {
            let snippet = generate_snippet(&req, *lang);
            assert!(!snippet.is_empty());
        }
    }
}

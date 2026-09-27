use crate::models::request_tab_state::{ResponseBodyViewMode, ResponseSubtab};
use crate::models::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the HTTP Response viewer with status code badge, metrics, Pretty/Raw body and headers.
pub fn render_response_viewer(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if let Some(err) = &tab.error_message {
        return div()
            .flex()
            .flex_col()
            .flex_1()
            .p_4()
            .rounded_sm()
            .bg(theme.surface)
            .border_1()
            .border_color(theme.border)
            .gap_2()
            .child(
                div()
                    .text_sm()
                    .font_weight(FontWeight::BOLD)
                    .text_color(theme.method_delete)
                    .child("Request Error"),
            )
            .child(
                div()
                    .text_xs()
                    .text_color(theme.text_secondary)
                    .child(err.clone()),
            );
    }

    let response = match &tab.response {
        Some(res) => res,
        None => {
            return div()
                .flex()
                .flex_col()
                .flex_1()
                .items_center()
                .justify_center()
                .rounded_sm()
                .border_t_1()
                .border_color(theme.border)
                .gap_2()
                .child(
                    div()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .child("Click 'Send' to execute this request and inspect response"),
                );
        }
    };

    let is_success = response.status >= 200 && response.status < 300;
    let status_color = if is_success {
        theme.method_get
    } else if response.status >= 400 {
        theme.method_delete
    } else {
        theme.method_put
    };

    let size_display = if response.size_bytes > 1024 {
        format!("{:.1} KB", (response.size_bytes as f64) / 1024.0)
    } else {
        format!("{} B", response.size_bytes)
    };

    let latency_display = format!("{:.0} ms", response.timing.total_ms);

    let headers_count = response.headers.len();
    let current_subtab = tab.response_subtab;
    let view_mode = tab.response_view_mode;

    // 1. Top Response Header Bar: Body | Cookies | Headers (N) <---------> Status | Time | Size
    let header_bar = div()
        .flex()
        .items_center()
        .justify_between()
        .h(px(34.0))
        .border_b_1()
        .border_color(theme.border)
        // Left: Subtabs with blue active underline
        .child(
            div()
                .flex()
                .items_center()
                .gap_4()
                .h_full()
                // Body Tab
                .child({
                    let is_active = current_subtab == ResponseSubtab::Body;
                    let v = view.clone();
                    div()
                        .id("res-tab-body")
                        .flex()
                        .items_center()
                        .h_full()
                        .px_1()
                        .cursor_pointer()
                        .when(is_active, |s| {
                            s.border_b_2()
                                .border_color(theme.primary)
                                .text_color(theme.text_primary)
                                .font_weight(FontWeight::BOLD)
                        })
                        .when(!is_active, |s| {
                            s.text_color(theme.text_secondary)
                                .hover(|st| st.text_color(theme.text_primary))
                        })
                        .text_xs()
                        .on_click(move |_, _w, cx| {
                            v.update(cx, |this, cx| {
                                if let Some(t) = this.state.active_tab_mut() {
                                    t.response_subtab = ResponseSubtab::Body;
                                }
                                cx.notify();
                            });
                        })
                        .child("Body")
                })
                // Cookies Tab
                .child({
                    let is_active = current_subtab == ResponseSubtab::Cookies;
                    let v = view.clone();
                    div()
                        .id("res-tab-cookies")
                        .flex()
                        .items_center()
                        .h_full()
                        .px_1()
                        .cursor_pointer()
                        .when(is_active, |s| {
                            s.border_b_2()
                                .border_color(theme.primary)
                                .text_color(theme.text_primary)
                                .font_weight(FontWeight::BOLD)
                        })
                        .when(!is_active, |s| {
                            s.text_color(theme.text_secondary)
                                .hover(|st| st.text_color(theme.text_primary))
                        })
                        .text_xs()
                        .on_click(move |_, _w, cx| {
                            v.update(cx, |this, cx| {
                                if let Some(t) = this.state.active_tab_mut() {
                                    t.response_subtab = ResponseSubtab::Cookies;
                                }
                                cx.notify();
                            });
                        })
                        .child("Cookies")
                })
                // Headers (N) Tab
                .child({
                    let is_active = current_subtab == ResponseSubtab::Headers;
                    let v = view.clone();
                    div()
                        .id("res-tab-headers")
                        .flex()
                        .items_center()
                        .gap_1()
                        .h_full()
                        .px_1()
                        .cursor_pointer()
                        .when(is_active, |s| {
                            s.border_b_2()
                                .border_color(theme.primary)
                                .text_color(theme.text_primary)
                                .font_weight(FontWeight::BOLD)
                        })
                        .when(!is_active, |s| {
                            s.text_color(theme.text_secondary)
                                .hover(|st| st.text_color(theme.text_primary))
                        })
                        .text_xs()
                        .on_click(move |_, _w, cx| {
                            v.update(cx, |this, cx| {
                                if let Some(t) = this.state.active_tab_mut() {
                                    t.response_subtab = ResponseSubtab::Headers;
                                }
                                cx.notify();
                            });
                        })
                        .child(div().child("Headers"))
                        .child(
                            div()
                                .text_color(theme.method_get)
                                .font_weight(FontWeight::BOLD)
                                .child(format!("({})", headers_count)),
                        )
                }),
        )
        // Right: Status Badge & Latency & Size Metrics
        .child(
            div()
                .flex()
                .items_center()
                .gap_4()
                .text_xs()
                // Status: 200 OK
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .child(
                            div()
                                .text_size(px(10.0))
                                .text_color(status_color)
                                .child("●"),
                        )
                        .child(div().text_color(theme.text_muted).child("Status:"))
                        .child(
                            div()
                                .font_weight(FontWeight::BOLD)
                                .text_color(status_color)
                                .child(format!("{} {}", response.status, response.status_text)),
                        ),
                )
                // Time: 2949 ms
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .child(div().text_color(theme.text_muted).child("Time:"))
                        .child(
                            div()
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.method_get)
                                .child(latency_display),
                        ),
                )
                // Size: 598 B
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .child(div().text_color(theme.text_muted).child("Size:"))
                        .child(
                            div()
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.method_get)
                                .child(size_display),
                        ),
                ),
        );

    // 2. Format Sub-Toolbar: [ Pretty | Raw | Preview ]  [ Auto (JSON) ⌄ ]  <----->  ≡ ⧉ 🔍
    let format_toolbar = div()
        .flex()
        .items_center()
        .justify_between()
        .h(px(32.0))
        .py_1()
        // Left: Segmented Format Pill + Format Dropdown
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                // Segmented control [ Pretty | Raw | Preview ]
                .child(
                    div()
                        .flex()
                        .items_center()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_md()
                        .p_0p5()
                        .child({
                            let is_pretty = view_mode == ResponseBodyViewMode::Pretty;
                            let v = view.clone();
                            div()
                                .id("view-mode-pretty")
                                .px_2p5()
                                .py_0p5()
                                .rounded_sm()
                                .text_size(px(11.0))
                                .cursor_pointer()
                                .when(is_pretty, |s| {
                                    s.bg(theme.surface_hover)
                                        .text_color(theme.text_primary)
                                        .font_weight(FontWeight::BOLD)
                                })
                                .when(!is_pretty, |s| {
                                    s.text_color(theme.text_muted)
                                        .hover(|st| st.text_color(theme.text_primary))
                                })
                                .on_click(move |_, _w, cx| {
                                    v.update(cx, |this, cx| {
                                        if let Some(t) = this.state.active_tab_mut() {
                                            t.response_view_mode = ResponseBodyViewMode::Pretty;
                                        }
                                        cx.notify();
                                    });
                                })
                                .child("Pretty")
                        })
                        .child({
                            let is_raw = view_mode == ResponseBodyViewMode::Raw;
                            let v = view.clone();
                            div()
                                .id("view-mode-raw")
                                .px_2p5()
                                .py_0p5()
                                .rounded_sm()
                                .text_size(px(11.0))
                                .cursor_pointer()
                                .when(is_raw, |s| {
                                    s.bg(theme.surface_hover)
                                        .text_color(theme.text_primary)
                                        .font_weight(FontWeight::BOLD)
                                })
                                .when(!is_raw, |s| {
                                    s.text_color(theme.text_muted)
                                        .hover(|st| st.text_color(theme.text_primary))
                                })
                                .on_click(move |_, _w, cx| {
                                    v.update(cx, |this, cx| {
                                        if let Some(t) = this.state.active_tab_mut() {
                                            t.response_view_mode = ResponseBodyViewMode::Raw;
                                        }
                                        cx.notify();
                                    });
                                })
                                .child("Raw")
                        })
                        .child({
                            let is_preview = view_mode == ResponseBodyViewMode::Preview;
                            let v = view.clone();
                            div()
                                .id("view-mode-preview")
                                .px_2p5()
                                .py_0p5()
                                .rounded_sm()
                                .text_size(px(11.0))
                                .cursor_pointer()
                                .when(is_preview, |s| {
                                    s.bg(theme.surface_hover)
                                        .text_color(theme.text_primary)
                                        .font_weight(FontWeight::BOLD)
                                })
                                .when(!is_preview, |s| {
                                    s.text_color(theme.text_muted)
                                        .hover(|st| st.text_color(theme.text_primary))
                                })
                                .on_click(move |_, _w, cx| {
                                    v.update(cx, |this, cx| {
                                        if let Some(t) = this.state.active_tab_mut() {
                                            t.response_view_mode = ResponseBodyViewMode::Preview;
                                        }
                                        cx.notify();
                                    });
                                })
                                .child("Preview")
                        }),
                )
                // Language Dropdown Pill [ Auto (JSON) ⌄ ]
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .h(px(24.0))
                        .px_2()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .text_size(px(11.0))
                        .text_color(theme.text_secondary)
                        .cursor_pointer()
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        .child("Auto (JSON)")
                        .child(
                            div()
                                .text_size(px(9.0))
                                .text_color(theme.text_muted)
                                .child("⌄"),
                        ),
                ),
        )
        // Right Tools: Wrap, Copy, Search
        .child(
            div()
                .flex()
                .items_center()
                .gap_1()
                // Wrap Toggle Icon
                .child(
                    div()
                        .id("btn-res-wrap")
                        .flex()
                        .items_center()
                        .justify_center()
                        .size(px(24.0))
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(12.0))
                        .text_color(theme.text_muted)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        .child("≡"),
                )
                // Copy Icon
                .child({
                    let body_text = response.body.clone();
                    div()
                        .id("btn-res-copy")
                        .flex()
                        .items_center()
                        .justify_center()
                        .size(px(24.0))
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(12.0))
                        .text_color(theme.text_muted)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        .on_click(move |_, _w, cx| {
                            cx.write_to_clipboard(gpui::ClipboardItem::new_string(
                                body_text.clone(),
                            ));
                        })
                        .child("⧉")
                })
                // Search Icon
                .child(
                    div()
                        .id("btn-res-search")
                        .flex()
                        .items_center()
                        .justify_center()
                        .size(px(24.0))
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(11.0))
                        .text_color(theme.text_muted)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        .child("🔍"),
                ),
        );

    // 3. Response Subtab Content (Body / Cookies / Headers)
    let body_content = match current_subtab {
        ResponseSubtab::Body => {
            if response.body.is_empty() {
                div()
                    .flex_1()
                    .py_4()
                    .text_xs()
                    .text_color(theme.text_muted)
                    .child("(Empty response body)")
            } else {
                let formatted_text = if view_mode == ResponseBodyViewMode::Pretty {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&response.body) {
                        serde_json::to_string_pretty(&parsed)
                            .unwrap_or_else(|_| response.body.clone())
                    } else {
                        response.body.clone()
                    }
                } else {
                    response.body.clone()
                };

                let lines: Vec<&str> = formatted_text.lines().collect();

                div()
                    .flex()
                    .flex_1()
                    .overflow_y_hidden()
                    .gap_3()
                    .pt_1()
                    // Line numbers gutter
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .w(px(28.0))
                            .text_size(px(12.0))
                            .text_color(theme.text_muted)
                            .items_end()
                            .pr_1()
                            .children(
                                (1..=lines.len())
                                    .map(|num| div().h(px(20.0)).child(format!("{}", num))),
                            ),
                    )
                    // Code lines with syntax highlighting
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .flex_1()
                            .text_size(px(12.0))
                            .children(lines.into_iter().map(|line| render_json_line(line, theme))),
                    )
            }
        }
        ResponseSubtab::Cookies => {
            // Find Set-Cookie headers
            let cookies: Vec<&(String, String)> = response
                .headers
                .iter()
                .filter(|(k, _)| k.to_lowercase() == "set-cookie" || k.to_lowercase() == "cookie")
                .collect();

            if cookies.is_empty() {
                div()
                    .flex_1()
                    .py_4()
                    .text_xs()
                    .text_color(theme.text_muted)
                    .child("No cookies received for this response.")
            } else {
                let mut cookies_col = div().flex().flex_col().flex_1().py_2().gap_1();
                for (k, v) in cookies {
                    cookies_col = cookies_col.child(
                        div()
                            .flex()
                            .items_center()
                            .gap_3()
                            .py_1()
                            .border_b_1()
                            .border_color(theme.border)
                            .text_xs()
                            .child(
                                div()
                                    .w(px(140.0))
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(theme.text_primary)
                                    .child(k.clone()),
                            )
                            .child(
                                div()
                                    .flex_1()
                                    .text_color(theme.text_secondary)
                                    .child(v.clone()),
                            ),
                    );
                }
                cookies_col
            }
        }
        ResponseSubtab::Headers => {
            let mut headers_col = div().flex().flex_col().flex_1().py_2().gap_1();
            for (h_key, h_val) in &response.headers {
                headers_col = headers_col.child(
                    div()
                        .flex()
                        .items_center()
                        .gap_3()
                        .py_1()
                        .border_b_1()
                        .border_color(theme.border)
                        .text_xs()
                        .child(
                            div()
                                .w(px(220.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.text_primary)
                                .child(h_key.clone()),
                        )
                        .child(
                            div()
                                .flex_1()
                                .text_color(theme.text_secondary)
                                .child(h_val.clone()),
                        ),
                );
            }
            headers_col
        }
        ResponseSubtab::Timeline => div()
            .flex()
            .flex_col()
            .flex_1()
            .py_2()
            .gap_2()
            .child(render_timeline_row(
                "DNS Lookup",
                response.timing.dns_ms,
                theme,
            ))
            .child(render_timeline_row(
                "TCP Connection",
                response.timing.tcp_ms,
                theme,
            ))
            .child(render_timeline_row(
                "TLS Handshake",
                response.timing.tls_ms,
                theme,
            ))
            .child(render_timeline_row(
                "Time to First Byte (TTFB)",
                response.timing.ttfb_ms,
                theme,
            ))
            .child(render_timeline_row(
                "Content Download",
                response.timing.download_ms,
                theme,
            ))
            .child(render_timeline_row(
                "Total Duration",
                response.timing.total_ms,
                theme,
            )),
    };

    div()
        .flex()
        .flex_col()
        .flex_1()
        .child(header_bar)
        .child(format_toolbar)
        .child(body_content)
}

/// Tokenizes and highlights a single formatted JSON line with cyan keys, coral strings, gold braces.
fn render_json_line(line: &str, theme: &Theme) -> Div {
    let trimmed = line.trim_start();
    let indent_spaces = line.len() - trimmed.len();
    let indent_px = (indent_spaces as f32) * 8.0;

    let key_color = hsla(199.0 / 360.0, 0.90, 0.65, 1.0); // Sky Cyan #38bdf8
    let string_color = hsla(340.0 / 360.0, 0.85, 0.65, 1.0); // Coral Pink #fb7185
    let number_color = hsla(270.0 / 360.0, 0.85, 0.72, 1.0); // Light Violet #c084fc
    let brace_color = hsla(45.0 / 360.0, 0.95, 0.55, 1.0); // Gold / Yellow #eab308

    let mut line_row = div().flex().items_center().h(px(20.0)).pl(px(indent_px));

    if trimmed == "{"
        || trimmed == "}"
        || trimmed == "},"
        || trimmed == "["
        || trimmed == "]"
        || trimmed == "],"
    {
        let (brace, comma) = if trimmed.ends_with(',') {
            (&trimmed[..trimmed.len() - 1], Some(","))
        } else {
            (trimmed, None)
        };
        line_row = line_row.child(
            div()
                .text_color(brace_color)
                .font_weight(FontWeight::BOLD)
                .child(brace.to_string()),
        );
        if let Some(c) = comma {
            line_row = line_row.child(div().text_color(theme.text_muted).child(c));
        }
        return line_row;
    }

    // Check if line starts with a key `"key": ...`
    if let Some(rest) = trimmed.strip_prefix('"') {
        if let Some(quote_idx) = rest.find('"') {
            let key = &rest[..quote_idx];
            let after_key = &rest[quote_idx + 1..];
            if after_key.starts_with(':') {
                // It's a key!
                line_row = line_row
                    .child(div().text_color(key_color).child(format!("\"{}\"", key)))
                    .child(div().text_color(theme.text_muted).child(": "));

                let val_part = after_key[1..].trim_start();
                let (val_trimmed, comma) = if val_part.ends_with(',') {
                    (&val_part[..val_part.len() - 1], Some(","))
                } else {
                    (val_part, None)
                };

                if val_trimmed.starts_with('"') && val_trimmed.ends_with('"') {
                    line_row = line_row.child(
                        div()
                            .text_color(string_color)
                            .child(val_trimmed.to_string()),
                    );
                } else if val_trimmed == "{" || val_trimmed == "[" {
                    line_row = line_row.child(
                        div()
                            .text_color(brace_color)
                            .font_weight(FontWeight::BOLD)
                            .child(val_trimmed.to_string()),
                    );
                } else if !val_trimmed.is_empty() {
                    line_row = line_row.child(
                        div()
                            .text_color(number_color)
                            .child(val_trimmed.to_string()),
                    );
                }

                if let Some(c) = comma {
                    line_row = line_row.child(div().text_color(theme.text_muted).child(c));
                }
                return line_row;
            }
        }
    }

    // Check if array string value e.g. `"Why <em>WonderWidgets</em> are great",`
    if trimmed.starts_with('"') {
        let (val_trimmed, comma) = if trimmed.ends_with(',') {
            (&trimmed[..trimmed.len() - 1], Some(","))
        } else {
            (trimmed, None)
        };
        if val_trimmed.ends_with('"') {
            line_row = line_row.child(
                div()
                    .text_color(string_color)
                    .child(val_trimmed.to_string()),
            );
            if let Some(c) = comma {
                line_row = line_row.child(div().text_color(theme.text_muted).child(c));
            }
            return line_row;
        }
    }

    line_row.child(
        div()
            .text_color(theme.text_primary)
            .child(trimmed.to_string()),
    )
}

fn render_timeline_row(label: &str, ms: f64, theme: &Theme) -> impl IntoElement {
    div()
        .flex()
        .items_center()
        .justify_between()
        .h(px(24.0))
        .text_xs()
        .child(
            div()
                .text_color(theme.text_secondary)
                .child(label.to_string()),
        )
        .child(
            div()
                .font_weight(FontWeight::BOLD)
                .text_color(theme.text_primary)
                .child(format!("{:.2} ms", ms)),
        )
}

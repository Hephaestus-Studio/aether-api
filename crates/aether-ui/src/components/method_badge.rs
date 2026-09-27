use crate::theme::Theme;
use gpui::*;

/// Renders a small badge showing the HTTP method with appropriate theme color.
pub fn render_method_badge(method: &str, theme: &Theme) -> impl IntoElement {
    let method_upper = method.to_uppercase();
    let (color, text_label) = match method_upper.as_str() {
        "GET" => (theme.method_get, "GET"),
        "POST" => (theme.method_post, "POST"),
        "PUT" => (theme.method_put, "PUT"),
        "DELETE" => (theme.method_delete, "DEL"),
        "PATCH" => (theme.method_patch, "PAT"),
        "OPTIONS" => (theme.method_options, "OPT"),
        "HEAD" => (theme.method_head, "HEAD"),
        "WS" | "WEBSOCKET" => (theme.method_options, "WS"),
        "SSE" => (theme.method_head, "SSE"),
        _ => (theme.text_muted, "REQ"),
    };

    div()
        .flex()
        .items_center()
        .justify_center()
        .w(px(34.0))
        .h(px(18.0))
        .rounded_sm()
        .bg(hsla(color.h, color.s, color.l, 0.15))
        .text_color(color)
        .text_size(px(10.0))
        .font_weight(FontWeight::BOLD)
        .child(text_label)
}

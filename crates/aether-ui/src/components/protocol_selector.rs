//! Protocol Selector component for switching between HTTP, WebSocket, and SSE protocols.

use crate::models::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders a protocol selector badge / dropdown in the request bar.
pub fn render_protocol_selector(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    let current_protocol = tab.request.protocol.to_lowercase();
    let protocols = [
        ("http", "HTTP", gpui::hsla(217.0, 0.91, 0.60, 1.0)),
        ("websocket", "WS", gpui::hsla(270.0, 0.80, 0.70, 1.0)),
        ("sse", "SSE", gpui::hsla(190.0, 0.80, 0.60, 1.0)),
    ];

    let mut selector = div().flex().items_center().gap_1();

    for (p_id, p_label, p_color) in protocols {
        let is_selected = current_protocol == p_id;
        let view_p = view.clone();
        let p_str = p_id.to_string();

        selector = selector.child(
            div()
                .id(ElementId::Name(format!("protocol-pill-{}", p_id).into()))
                .px_2()
                .py_1()
                .rounded_sm()
                .text_size(px(10.0))
                .font_weight(FontWeight::BOLD)
                .cursor_pointer()
                .when(is_selected, |s| {
                    s.bg(theme.surface_hover)
                        .text_color(p_color)
                        .border_1()
                        .border_color(p_color)
                })
                .when(!is_selected, |s| {
                    s.text_color(theme.text_muted)
                        .hover(|h| h.bg(theme.surface_hover).text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    let proto = p_str.clone();
                    view_p.update(cx, |this, cx| {
                        this.switch_tab_protocol(&proto, cx);
                    });
                })
                .child(p_label),
        );
    }

    selector
}

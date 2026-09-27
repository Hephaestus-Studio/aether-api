//! WebSocket Editor and Stream Viewer Component for GPUI.
//!
//! Provides connection controls (Connect/Disconnect), URL configuration,
//! headers/params/auth tabs, message composer (JSON/Text/Binary), and a live
//! real-time message stream with filtering (All/In/Out/Ping-Pong), search, and metrics.

use crate::components::auth_editor::render_auth_editor;
use crate::components::key_value_editor::render_key_value_table;
use crate::components::text_area::TextArea;
use crate::components::text_input::TextInput;
use crate::models::websocket_state::{WsConnectionStatus, WsFilter, WsSubtab};
use crate::models::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the complete WebSocket Editor and Live Message Stream layout.
pub fn render_websocket_editor(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    url_input: Entity<TextInput>,
    composer_input: Entity<TextArea>,
) -> impl IntoElement {
    let ws_state = tab.ws_state.as_ref().cloned().unwrap_or_default();
    let status = ws_state.connection_status;
    let is_connected = status == WsConnectionStatus::Connected;
    let is_connecting = status == WsConnectionStatus::Connecting;

    // 1. Top WebSocket URL & Connect Bar
    let view_connect = view.clone();
    let status_color = match status {
        WsConnectionStatus::Connected => gpui::hsla(142.0, 0.70, 0.45, 1.0),
        WsConnectionStatus::Connecting => gpui::hsla(45.0, 0.95, 0.50, 1.0),
        WsConnectionStatus::Error => gpui::hsla(0.0, 0.85, 0.60, 1.0),
        WsConnectionStatus::Disconnected => theme.text_muted,
    };

    let status_text = match status {
        WsConnectionStatus::Connected => "Connected",
        WsConnectionStatus::Connecting => "Connecting...",
        WsConnectionStatus::Error => "Error",
        WsConnectionStatus::Disconnected => "Disconnected",
    };

    let url_bar = div()
        .flex()
        .items_center()
        .gap_2()
        .h(px(40.0))
        .px_3()
        .bg(theme.surface)
        .border_1()
        .border_color(theme.border)
        .rounded_md()
        // Protocol Badge: WS
        .child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .px_2()
                .py_1()
                .rounded_sm()
                .bg(gpui::hsla(270.0, 0.70, 0.55, 0.20))
                .text_color(gpui::hsla(270.0, 0.80, 0.70, 1.0))
                .text_size(px(11.0))
                .font_weight(FontWeight::BOLD)
                .child("WS"),
        )
        // URL Input Field
        .child(div().flex_1().child(url_input))
        // Connection Status Indicator Dot & Text
        .child(
            div()
                .flex()
                .items_center()
                .gap_1p5()
                .px_2()
                .py_1()
                .rounded_sm()
                .bg(theme.background)
                .border_1()
                .border_color(theme.border)
                .child(div().size(px(7.0)).rounded_full().bg(status_color))
                .child(
                    div()
                        .text_size(px(10.0))
                        .text_color(theme.text_secondary)
                        .child(status_text),
                ),
        )
        // Connect / Disconnect Action Button
        .child(
            div()
                .id("ws-connect-toggle-btn")
                .flex()
                .items_center()
                .justify_center()
                .px_4()
                .h(px(28.0))
                .rounded_sm()
                .cursor_pointer()
                .when(!is_connected && !is_connecting, |s| {
                    s.bg(theme.primary)
                        .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                        .hover(|h| h.bg(theme.primary_hover))
                })
                .when(is_connecting, |s| {
                    s.bg(gpui::hsla(45.0, 0.95, 0.50, 0.20))
                        .text_color(gpui::hsla(45.0, 0.95, 0.50, 1.0))
                })
                .when(is_connected, |s| {
                    s.bg(gpui::hsla(0.0, 0.75, 0.50, 0.20))
                        .text_color(gpui::hsla(0.0, 0.85, 0.65, 1.0))
                        .hover(|h| h.bg(gpui::hsla(0.0, 0.75, 0.50, 0.35)))
                })
                .text_xs()
                .font_weight(FontWeight::BOLD)
                .on_click(move |_, _window, cx| {
                    view_connect.update(cx, |this, cx| {
                        this.toggle_websocket_connection(cx);
                    });
                })
                .child(if is_connected {
                    "Disconnect"
                } else if is_connecting {
                    "Connecting..."
                } else {
                    "Connect"
                }),
        );

    // 2. Configuration Subtabs Header
    let subtabs = [
        (WsSubtab::Params, "Params"),
        (WsSubtab::Headers, "Headers"),
        (WsSubtab::Auth, "Authorization"),
        (WsSubtab::Saved, "Saved Messages"),
        (WsSubtab::Settings, "Settings"),
    ];

    let mut subtab_bar = div()
        .flex()
        .items_center()
        .gap_4()
        .h(px(32.0))
        .border_b_1()
        .border_color(theme.border);

    for (stype, label) in subtabs {
        let is_active = ws_state.active_subtab == stype;
        let view_subtab = view.clone();

        subtab_bar = subtab_bar.child(
            div()
                .id(ElementId::Name(format!("ws-subtab-{:?}", stype).into()))
                .flex()
                .items_center()
                .h_full()
                .px_1()
                .text_xs()
                .cursor_pointer()
                .when(is_active, |this| {
                    this.border_b_2()
                        .border_color(theme.primary)
                        .text_color(theme.text_primary)
                        .font_weight(FontWeight::BOLD)
                })
                .when(!is_active, |this| {
                    this.text_color(theme.text_secondary)
                        .hover(|s| s.text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    view_subtab.update(cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            if let Some(ws) = tab.ws_state.as_mut() {
                                ws.active_subtab = stype;
                            }
                        }
                        cx.notify();
                    });
                })
                .child(label),
        );
    }

    // Subtab content panel
    let subtab_content =
        match ws_state.active_subtab {
            WsSubtab::Params => render_key_value_table(
                &tab.request.params,
                theme,
                "ws_params",
                "No Query Parameters configured.",
                view.clone(),
                false,
            ),
            WsSubtab::Headers => render_key_value_table(
                &tab.request.headers,
                theme,
                "ws_headers",
                "No Custom Handshake Headers configured.",
                view.clone(),
                true,
            ),
            WsSubtab::Auth => render_auth_editor(tab, theme, view.clone()),
            WsSubtab::Saved => div().p_3().text_xs().text_color(theme.text_muted).child(
                "No saved message presets yet. Use 'Save Preset' below to bookmark payloads.",
            ),
            WsSubtab::Settings => div().p_3().text_xs().text_color(theme.text_muted).child(
                "WebSocket Settings: Ping/Pong Heartbeat interval: 30s | Auto-reconnect: Disabled",
            ),
        };

    // 3. Message Composer Bar (Format switcher, Send button)
    let view_send = view.clone();
    let formats = ["JSON", "Text", "Binary"];
    let mut format_selector = div().flex().items_center().gap_1();

    for fmt in formats {
        let fmt_lower = fmt.to_lowercase();
        let is_sel = ws_state.composer_format == fmt_lower;
        let view_fmt = view.clone();
        let fmt_val = fmt_lower.clone();

        format_selector = format_selector.child(
            div()
                .id(ElementId::Name(format!("ws-fmt-{}", fmt_val).into()))
                .px_2()
                .py_0p5()
                .rounded_sm()
                .text_size(px(11.0))
                .cursor_pointer()
                .when(is_sel, |s| {
                    s.bg(theme.surface_hover)
                        .text_color(theme.primary)
                        .font_weight(FontWeight::BOLD)
                })
                .when(!is_sel, |s| {
                    s.text_color(theme.text_muted)
                        .hover(|h| h.text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    let f = fmt_val.clone();
                    view_fmt.update(cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            if let Some(ws) = tab.ws_state.as_mut() {
                                ws.composer_format = f;
                            }
                        }
                        cx.notify();
                    });
                })
                .child(fmt),
        );
    }

    let composer_header = div()
        .flex()
        .items_center()
        .justify_between()
        .h(px(30.0))
        .px_1()
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                .child(
                    div()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.text_muted)
                        .child("MESSAGE COMPOSER"),
                )
                .child(format_selector),
        )
        .child(
            div()
                .id("ws-send-msg-btn")
                .flex()
                .items_center()
                .justify_center()
                .px_3()
                .h(px(24.0))
                .rounded_sm()
                .cursor_pointer()
                .when(is_connected, |s| {
                    s.bg(theme.primary)
                        .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                        .hover(|h| h.bg(theme.primary_hover))
                })
                .when(!is_connected, |s| {
                    s.bg(theme.surface_hover).text_color(theme.text_muted)
                })
                .text_xs()
                .font_weight(FontWeight::BOLD)
                .on_click(move |_, _window, cx| {
                    view_send.update(cx, |this, cx| {
                        this.send_websocket_message(cx);
                    });
                })
                .child("Send ↗"),
        );

    // 4. Live Message Stream Section
    let filtered_msgs = ws_state.filtered_messages();
    let view_clear = view.clone();
    let filters = [
        (WsFilter::All, "All"),
        (WsFilter::Incoming, "Incoming ▼"),
        (WsFilter::Outgoing, "Outgoing ▲"),
        (WsFilter::PingPong, "Ping / Pong"),
    ];

    let mut filter_bar = div().flex().items_center().gap_1();
    for (f_type, f_label) in filters {
        let is_active = ws_state.filter == f_type;
        let view_f = view.clone();

        filter_bar = filter_bar.child(
            div()
                .id(ElementId::Name(format!("ws-filter-{:?}", f_type).into()))
                .px_2()
                .py_0p5()
                .rounded_sm()
                .text_size(px(11.0))
                .cursor_pointer()
                .when(is_active, |s| {
                    s.bg(theme.surface_hover)
                        .text_color(theme.primary)
                        .font_weight(FontWeight::BOLD)
                })
                .when(!is_active, |s| {
                    s.text_color(theme.text_muted)
                        .hover(|h| h.text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    view_f.update(cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            if let Some(ws) = tab.ws_state.as_mut() {
                                ws.filter = f_type;
                            }
                        }
                        cx.notify();
                    });
                })
                .child(f_label),
        );
    }

    let stream_header = div()
        .flex()
        .items_center()
        .justify_between()
        .h(px(32.0))
        .px_3()
        .bg(theme.surface)
        .border_t_1()
        .border_b_1()
        .border_color(theme.border)
        .child(
            div()
                .flex()
                .items_center()
                .gap_3()
                .child(
                    div()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.text_muted)
                        .child(format!("MESSAGES ({})", filtered_msgs.len())),
                )
                .child(filter_bar),
        )
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                // Metrics summary: Sent / Received count
                .child(
                    div()
                        .text_size(px(10.0))
                        .text_color(theme.text_muted)
                        .child(format!(
                            "▲ {} ({} B) | ▼ {} ({} B)",
                            ws_state.metrics.sent_count,
                            ws_state.metrics.sent_bytes,
                            ws_state.metrics.received_count,
                            ws_state.metrics.received_bytes
                        )),
                )
                // Clear button
                .child(
                    div()
                        .id("ws-clear-btn")
                        .px_2()
                        .py_0p5()
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(11.0))
                        .text_color(theme.text_muted)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        .on_click(move |_, _window, cx| {
                            view_clear.update(cx, |this, cx| {
                                if let Some(tab) = this.state.active_tab_mut() {
                                    if let Some(ws) = tab.ws_state.as_mut() {
                                        ws.clear_messages();
                                    }
                                }
                                cx.notify();
                            });
                        })
                        .child("Clear"),
                ),
        );

    let mut stream_list = div()
        .flex()
        .flex_col()
        .flex_1()
        .overflow_y_hidden()
        .bg(theme.background)
        .p_2()
        .gap_1();

    if filtered_msgs.is_empty() {
        stream_list = stream_list.child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .py_8()
                .text_xs()
                .text_color(theme.text_muted)
                .child(if is_connected {
                    "Connected. Waiting for incoming or outgoing messages..."
                } else {
                    "Click 'Connect' to open WebSocket stream."
                }),
        );
    } else {
        for msg in filtered_msgs {
            let is_in = msg.direction == "in";
            let dir_icon = if is_in { "▼ IN" } else { "▲ OUT" };
            let dir_color = if is_in {
                gpui::hsla(142.0, 0.70, 0.45, 1.0)
            } else {
                gpui::hsla(217.0, 0.91, 0.60, 1.0)
            };

            let row = div()
                .flex()
                .flex_col()
                .p_2()
                .rounded_sm()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .gap_1()
                // Message Meta Header
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .text_size(px(10.0))
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2()
                                .child(
                                    div()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(dir_color)
                                        .child(dir_icon),
                                )
                                .child(
                                    div()
                                        .px_1()
                                        .rounded_xs()
                                        .bg(theme.background)
                                        .text_color(theme.text_muted)
                                        .child(msg.format.to_uppercase()),
                                )
                                .child(
                                    div()
                                        .text_color(theme.text_muted)
                                        .child(format!("{} B", msg.size)),
                                ),
                        )
                        .child(
                            div().text_color(theme.text_muted).child(
                                chrono::DateTime::from_timestamp_millis(msg.timestamp)
                                    .map(|dt| dt.format("%H:%M:%S%.3f").to_string())
                                    .unwrap_or_default(),
                            ),
                        ),
                )
                // Message Payload Body
                .child(
                    div()
                        .text_xs()
                        .text_color(theme.text_primary)
                        .font_family(".SystemUIFont")
                        .child(msg.payload.clone()),
                );

            stream_list = stream_list.child(row);
        }
    }

    // Full Layout Container
    div()
        .flex()
        .flex_col()
        .flex_1()
        .gap_3()
        // 1. Top URL Bar
        .child(url_bar)
        // 2. Split Area: Top Config/Composer + Bottom Message Stream
        .child(
            div()
                .flex()
                .flex_col()
                .flex_1()
                .gap_3()
                // Top Configuration & Composer Panel
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .h(px(240.0))
                        .gap_2()
                        .child(subtab_bar)
                        .child(div().h(px(80.0)).overflow_y_hidden().child(subtab_content))
                        .child(composer_header)
                        .child(div().flex_1().child(composer_input)),
                )
                // Bottom Message Stream Panel
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .flex_1()
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .overflow_hidden()
                        .child(stream_header)
                        .child(stream_list),
                ),
        )
}

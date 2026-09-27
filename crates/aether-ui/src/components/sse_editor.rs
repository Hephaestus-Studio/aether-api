//! Server-Sent Events (SSE) Editor and Live Stream Viewer Component for GPUI.
//!
//! Provides SSE connection controls (Connect/Disconnect), URL configuration,
//! method switcher (GET / POST), params/headers/auth/body tabs, and a live
//! event stream with event type filtering, search, and event badges (ID, retry, timestamp).

use crate::components::auth_editor::render_auth_editor;
use crate::components::body_editor::render_body_editor;
use crate::components::key_value_editor::render_key_value_table;
use crate::components::text_area::TextArea;
use crate::components::text_input::TextInput;
use crate::models::sse_state::{SseConnectionStatus, SseSubtab};
use crate::models::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::request::HttpMethod;
use gpui::prelude::*;
use gpui::*;

/// Renders the complete SSE Editor and Live Event Stream layout.
pub fn render_sse_editor(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    url_input: Entity<TextInput>,
    body_input: Entity<TextArea>,
) -> impl IntoElement {
    let sse_state = tab.sse_state.as_ref().cloned().unwrap_or_default();
    let status = sse_state.connection_status;
    let is_connected = status == SseConnectionStatus::Connected;
    let is_connecting = status == SseConnectionStatus::Connecting;

    // 1. Top SSE URL & Connect Bar
    let view_connect = view.clone();
    let view_method = view.clone();
    let status_color = match status {
        SseConnectionStatus::Connected => gpui::hsla(142.0, 0.70, 0.45, 1.0),
        SseConnectionStatus::Connecting => gpui::hsla(45.0, 0.95, 0.50, 1.0),
        SseConnectionStatus::Error => gpui::hsla(0.0, 0.85, 0.60, 1.0),
        SseConnectionStatus::Disconnected => theme.text_muted,
    };

    let status_text = match status {
        SseConnectionStatus::Connected => "Streaming",
        SseConnectionStatus::Connecting => "Connecting...",
        SseConnectionStatus::Error => "Error",
        SseConnectionStatus::Disconnected => "Disconnected",
    };

    let method_is_post = tab.request.method == HttpMethod::Post;

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
        // Method Selector (GET or POST)
        .child(
            div()
                .flex()
                .items_center()
                .gap_1()
                .child(
                    div()
                        .id("sse-method-get-btn")
                        .px_2()
                        .py_1()
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .when(!method_is_post, |s| {
                            s.bg(gpui::hsla(142.0, 0.70, 0.45, 0.20))
                                .text_color(gpui::hsla(142.0, 0.70, 0.45, 1.0))
                        })
                        .when(method_is_post, |s| s.text_color(theme.text_muted))
                        .on_click(move |_, _window, cx| {
                            view_method.update(cx, |this, cx| {
                                if let Some(tab) = this.state.active_tab_mut() {
                                    tab.request.method = HttpMethod::Get;
                                    tab.is_dirty = true;
                                }
                                cx.notify();
                            });
                        })
                        .child("GET"),
                )
                .child({
                    let view_post = view.clone();
                    div()
                        .id("sse-method-post-btn")
                        .px_2()
                        .py_1()
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .when(method_is_post, |s| {
                            s.bg(gpui::hsla(45.0, 0.95, 0.50, 0.20))
                                .text_color(gpui::hsla(45.0, 0.95, 0.50, 1.0))
                        })
                        .when(!method_is_post, |s| s.text_color(theme.text_muted))
                        .on_click(move |_, _window, cx| {
                            view_post.update(cx, |this, cx| {
                                if let Some(tab) = this.state.active_tab_mut() {
                                    tab.request.method = HttpMethod::Post;
                                    tab.is_dirty = true;
                                }
                                cx.notify();
                            });
                        })
                        .child("POST")
                }),
        )
        // Protocol Badge: SSE
        .child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .px_2()
                .py_1()
                .rounded_sm()
                .bg(gpui::hsla(190.0, 0.70, 0.45, 0.20))
                .text_color(gpui::hsla(190.0, 0.80, 0.60, 1.0))
                .text_size(px(11.0))
                .font_weight(FontWeight::BOLD)
                .child("SSE"),
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
                .id("sse-connect-toggle-btn")
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
                        this.toggle_sse_connection(cx);
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
        (SseSubtab::Params, "Params"),
        (SseSubtab::Headers, "Headers"),
        (SseSubtab::Auth, "Authorization"),
        (SseSubtab::Body, "Body"),
        (SseSubtab::Settings, "Settings"),
    ];

    let mut subtab_bar = div()
        .flex()
        .items_center()
        .gap_4()
        .h(px(32.0))
        .border_b_1()
        .border_color(theme.border);

    for (stype, label) in subtabs {
        let is_active = sse_state.active_subtab == stype;
        let view_subtab = view.clone();

        subtab_bar = subtab_bar.child(
            div()
                .id(ElementId::Name(format!("sse-subtab-{:?}", stype).into()))
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
                            if let Some(sse) = tab.sse_state.as_mut() {
                                sse.active_subtab = stype;
                            }
                        }
                        cx.notify();
                    });
                })
                .child(label),
        );
    }

    // Subtab content panel
    let subtab_content = match sse_state.active_subtab {
        SseSubtab::Params => render_key_value_table(
            &tab.request.params,
            theme,
            "sse_params",
            "No Query Parameters configured.",
            view.clone(),
            false,
        ),
        SseSubtab::Headers => render_key_value_table(
            &tab.request.headers,
            theme,
            "sse_headers",
            "No Custom Headers configured.",
            view.clone(),
            true,
        ),
        SseSubtab::Auth => render_auth_editor(tab, theme, view.clone()),
        SseSubtab::Body => render_body_editor(tab, theme, view.clone(), body_input),
        SseSubtab::Settings => div().p_3().text_xs().text_color(theme.text_muted).child(
            "SSE Settings: Auto-reconnect: Enabled | Retry interval: Server-defined (default 3s)",
        ),
    };

    // 3. Live Event Stream Section
    let filtered_events = sse_state.filtered_events();
    let view_clear = view.clone();
    let unique_types = sse_state.unique_event_types();

    let mut type_filter_bar = div().flex().items_center().gap_1();
    let is_all_type = sse_state.selected_event_type.is_none()
        || sse_state.selected_event_type.as_deref() == Some("all");
    let view_all_type = view.clone();

    type_filter_bar = type_filter_bar.child(
        div()
            .id("sse-filter-all-btn")
            .px_2()
            .py_0p5()
            .rounded_sm()
            .text_size(px(11.0))
            .cursor_pointer()
            .when(is_all_type, |s| {
                s.bg(theme.surface_hover)
                    .text_color(theme.primary)
                    .font_weight(FontWeight::BOLD)
            })
            .when(!is_all_type, |s| {
                s.text_color(theme.text_muted)
                    .hover(|h| h.text_color(theme.text_primary))
            })
            .on_click(move |_, _window, cx| {
                view_all_type.update(cx, |this, cx| {
                    if let Some(tab) = this.state.active_tab_mut() {
                        if let Some(sse) = tab.sse_state.as_mut() {
                            sse.selected_event_type = None;
                        }
                    }
                    cx.notify();
                });
            })
            .child("All Events"),
    );

    for ev_type in unique_types {
        let is_sel = sse_state.selected_event_type.as_deref() == Some(&ev_type);
        let view_t = view.clone();
        let ev_str = ev_type.clone();
        let ev_id_name = format!("sse-filter-type-{}", ev_type);

        type_filter_bar = type_filter_bar.child(
            div()
                .id(ElementId::Name(ev_id_name.into()))
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
                    let et = ev_str.clone();
                    view_t.update(cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            if let Some(sse) = tab.sse_state.as_mut() {
                                sse.selected_event_type = Some(et);
                            }
                        }
                        cx.notify();
                    });
                })
                .child(ev_type),
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
                        .child(format!("EVENT STREAM ({})", filtered_events.len())),
                )
                .child(type_filter_bar),
        )
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                // Metrics summary: Received count / bytes
                .child(
                    div()
                        .text_size(px(10.0))
                        .text_color(theme.text_muted)
                        .child(format!(
                            "Events: {} ({} B)",
                            sse_state.metrics.received_count, sse_state.metrics.received_bytes
                        )),
                )
                // Clear button
                .child(
                    div()
                        .id("sse-clear-events-btn")
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
                                    if let Some(sse) = tab.sse_state.as_mut() {
                                        sse.clear_events();
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

    if filtered_events.is_empty() {
        stream_list = stream_list.child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .py_8()
                .text_xs()
                .text_color(theme.text_muted)
                .child(if is_connected {
                    "Listening for Server-Sent Events stream..."
                } else {
                    "Click 'Connect' to begin receiving Server-Sent Events."
                }),
        );
    } else {
        for ev in filtered_events {
            let row = div()
                .flex()
                .flex_col()
                .p_2()
                .rounded_sm()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .gap_1()
                // Event Meta Header
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
                                        .px_1()
                                        .rounded_xs()
                                        .bg(gpui::hsla(190.0, 0.70, 0.45, 0.20))
                                        .text_color(gpui::hsla(190.0, 0.80, 0.60, 1.0))
                                        .font_weight(FontWeight::BOLD)
                                        .child(ev.event.clone()),
                                )
                                .when_some(ev.event_id.as_ref(), |s, id| {
                                    s.child(
                                        div()
                                            .text_color(theme.text_muted)
                                            .child(format!("id: {}", id)),
                                    )
                                })
                                .child(
                                    div()
                                        .text_color(theme.text_muted)
                                        .child(format!("{} B", ev.size)),
                                ),
                        )
                        .child(
                            div().text_color(theme.text_muted).child(
                                chrono::DateTime::from_timestamp_millis(ev.timestamp)
                                    .map(|dt| dt.format("%H:%M:%S%.3f").to_string())
                                    .unwrap_or_default(),
                            ),
                        ),
                )
                // Event Data Body
                .child(
                    div()
                        .text_xs()
                        .text_color(theme.text_primary)
                        .font_family(".SystemUIFont")
                        .child(ev.data.clone()),
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
        // 2. Split Area: Top Config (Params/Headers/Auth/Body) + Bottom Event Stream
        .child(
            div()
                .flex()
                .flex_col()
                .flex_1()
                .gap_3()
                // Top Configuration Panel
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .h(px(180.0))
                        .gap_2()
                        .child(subtab_bar)
                        .child(div().flex_1().overflow_y_hidden().child(subtab_content)),
                )
                // Bottom Event Stream Panel
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

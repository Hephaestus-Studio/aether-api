use crate::components::TextInput;
use crate::models::request_tab_state::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::request::HttpMethod;
use gpui::prelude::*;
use gpui::*;

/// Renders the Request Top Header & URL Bar matching the original design.
pub fn render_url_bar(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    url_input: Entity<TextInput>,
) -> impl IntoElement {
    let view_send = view.clone();
    let view_save = view.clone();
    let view_code = view.clone();
    let view_method = view.clone();
    let is_sending = tab.is_sending;
    let is_dirty = tab.is_dirty;
    let current_method_str = tab.request.method.to_string();

    let method_color = match tab.request.method {
        HttpMethod::Get => theme.method_get,
        HttpMethod::Post => theme.method_post,
        HttpMethod::Put => theme.method_put,
        HttpMethod::Delete => theme.method_delete,
        HttpMethod::Patch => theme.method_patch,
        HttpMethod::Options => theme.method_options,
        HttpMethod::Head => theme.method_head,
        _ => theme.text_primary,
    };

    div()
        .flex()
        .flex_col()
        .gap_2p5()
        .w_full()
        // Row 1: Protocol Dropdown + Request Name Title + Code/Save Action Buttons
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .gap_3()
                // Left: Protocol Pill + Editable Request Name
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_3()
                        .flex_1()
                        // Protocol Pill: [ 🌐 HTTP ⌄ ]
                        .child(
                            div()
                                .id("req-protocol-btn")
                                .flex()
                                .items_center()
                                .gap_1p5()
                                .h(px(30.0))
                                .px_2p5()
                                .bg(theme.surface)
                                .border_1()
                                .border_color(theme.border)
                                .rounded_md()
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.surface_hover))
                                .child(
                                    div()
                                        .text_size(px(11.0))
                                        .text_color(theme.primary)
                                        .child("🌐"),
                                )
                                .child(
                                    div()
                                        .text_xs()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child("HTTP"),
                                )
                                .child(
                                    div()
                                        .text_size(px(9.0))
                                        .text_color(theme.text_muted)
                                        .child("⌄"),
                                ),
                        )
                        // Request Title Display / Name
                        .child(
                            div()
                                .text_sm()
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.text_primary)
                                .child(if tab.request.name.is_empty() {
                                    "Untitled Request".to_string()
                                } else {
                                    tab.request.name.clone()
                                }),
                        ),
                )
                // Right: </> Code & Save Action Buttons
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        // </> Code Snippet Button
                        .child(
                            div()
                                .id("btn-open-snippet")
                                .flex()
                                .items_center()
                                .gap_1p5()
                                .h(px(30.0))
                                .px_3()
                                .bg(theme.surface)
                                .border_1()
                                .border_color(theme.border)
                                .rounded_md()
                                .cursor_pointer()
                                .text_xs()
                                .text_color(theme.text_secondary)
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                .on_click(move |_, _window, cx| {
                                    view_code.update(cx, |this, cx| {
                                        this.open_snippet_modal(cx);
                                    });
                                })
                                .child(
                                    div()
                                        .text_size(px(11.0))
                                        .font_weight(FontWeight::BOLD)
                                        .child("</>"),
                                )
                                .child("Code"),
                        )
                        // Save Button
                        .child(
                            div()
                                .id("save-request-btn")
                                .flex()
                                .items_center()
                                .justify_center()
                                .h(px(30.0))
                                .px_4()
                                .bg(theme.surface)
                                .border_1()
                                .border_color(if is_dirty {
                                    theme.primary
                                } else {
                                    theme.border
                                })
                                .rounded_md()
                                .cursor_pointer()
                                .text_xs()
                                .text_color(if is_dirty {
                                    theme.primary
                                } else {
                                    theme.text_muted
                                })
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                .on_click(move |_, _window, cx| {
                                    view_save.update(cx, |this, cx| {
                                        this.save_active_request(cx);
                                    });
                                })
                                .child("Save"),
                        ),
                ),
        )
        // Row 2: Method Selector + URL Input Box + Send Button
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                .h(px(38.0))
                .w_full()
                // Method Selector Pill [ GET ⌄ ]
                .child(
                    div()
                        .id("method-selector-btn")
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .h_full()
                        .px_3()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_md()
                        .cursor_pointer()
                        .hover(|s| s.bg(theme.surface_hover))
                        .on_click(move |_, _window, cx| {
                            view_method.update(cx, |this, cx| {
                                if let Some(tab) = this.state.active_tab_mut() {
                                    let next_method = match tab.request.method {
                                        HttpMethod::Get => HttpMethod::Post,
                                        HttpMethod::Post => HttpMethod::Put,
                                        HttpMethod::Put => HttpMethod::Delete,
                                        HttpMethod::Delete => HttpMethod::Patch,
                                        HttpMethod::Patch => HttpMethod::Options,
                                        HttpMethod::Options => HttpMethod::Head,
                                        _ => HttpMethod::Get,
                                    };
                                    tab.set_method(next_method);
                                }
                                cx.notify();
                            });
                        })
                        .child(
                            div()
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .text_color(method_color)
                                .child(current_method_str),
                        )
                        .child(
                            div()
                                .text_size(px(9.0))
                                .text_color(theme.text_muted)
                                .child("⌄"),
                        ),
                )
                // URL Input Field — Using native TextInput component
                .child(
                    div()
                        .flex()
                        .items_center()
                        .flex_1()
                        .h_full()
                        .child(url_input),
                )
                // Send / Cancel Button
                .child(if is_sending {
                    let view_cancel = view.clone();
                    div()
                        .id("cancel-request-btn")
                        .flex()
                        .items_center()
                        .justify_center()
                        .h_full()
                        .px_4()
                        .bg(hsla(0.0, 0.70, 0.50, 0.85))
                        .rounded_md()
                        .cursor_pointer()
                        .text_xs()
                        .font_weight(FontWeight::BOLD)
                        .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                        .hover(|s| s.bg(hsla(0.0, 0.80, 0.45, 1.0)))
                        .on_click(move |_, _window, cx| {
                            view_cancel.update(cx, |this, cx| {
                                this.cancel_active_request(cx);
                            });
                        })
                        .child("✕ Cancel")
                } else {
                    div()
                        .id("send-request-btn")
                        .flex()
                        .items_center()
                        .justify_center()
                        .h_full()
                        .px_5()
                        .bg(theme.primary)
                        .rounded_md()
                        .cursor_pointer()
                        .text_xs()
                        .font_weight(FontWeight::BOLD)
                        .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                        .hover(|s| s.bg(theme.primary_hover))
                        .on_click(move |_, _window, cx| {
                            view_send.update(cx, |this, cx| {
                                this.send_active_request(cx);
                            });
                        })
                        .child("Send")
                }),
        )
}

use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::request::KeyValuePair;
use gpui::prelude::*;
use gpui::*;

/// Renders a responsive Key-Value table for query params, headers, or form data.
pub fn render_key_value_table(
    items: &[KeyValuePair],
    theme: &Theme,
    title: &str,
    empty_label: &str,
    view: Entity<WorkspaceView>,
    is_headers: bool,
) -> Div {
    let view_add = view.clone();

    let mut table_content = div().flex().flex_col().w_full().gap_1();

    // Table Header Row: [ ] | KEY | VALUE | DESCRIPTION | [delete action]
    let header_row = div()
        .flex()
        .items_center()
        .h(px(26.0))
        .px_2()
        .text_size(px(11.0))
        .font_weight(FontWeight::BOLD)
        .text_color(theme.text_muted)
        .child(div().w(px(28.0)).child(""))
        .child(div().w(px(180.0)).child("KEY"))
        .child(div().w(px(240.0)).child("VALUE"))
        .child(div().flex_1().child("DESCRIPTION"))
        .child(div().w(px(32.0)).child(""));

    table_content = table_content.child(header_row);

    if items.is_empty() {
        table_content = table_content.child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .py_6()
                .text_xs()
                .text_color(theme.text_muted)
                .child(empty_label.to_string()),
        );
    } else {
        for (idx, item) in items.iter().enumerate() {
            let row_idx = idx;
            let view_toggle = view.clone();
            let view_delete = view.clone();
            let is_enabled = item.enabled;

            let row = div()
                .id(ElementId::Name(
                    format!("kv-row-{}-{}", title, row_idx).into(),
                ))
                .flex()
                .items_center()
                .h(px(32.0))
                .px_2()
                .rounded_sm()
                .hover(|s| s.bg(theme.surface_hover))
                .border_b_1()
                .border_color(theme.border)
                .gap_2()
                // Checkbox enable/disable toggle
                .child(
                    div()
                        .id(ElementId::Name(
                            format!("kv-toggle-{}-{}", title, row_idx).into(),
                        ))
                        .w(px(20.0))
                        .h(px(20.0))
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded_sm()
                        .cursor_pointer()
                        .when(is_enabled, |s| {
                            s.bg(theme.primary)
                                .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                .text_size(px(12.0))
                                .font_weight(FontWeight::BOLD)
                        })
                        .when(!is_enabled, |s| {
                            s.border_1()
                                .border_color(theme.border)
                                .text_color(gpui::hsla(0.0, 0.0, 0.0, 0.0))
                        })
                        .on_click(move |_, _window, cx| {
                            view_toggle.update(cx, |this, cx| {
                                if let Some(tab) = this.state.active_tab_mut() {
                                    if is_headers {
                                        if let Some(h) = tab.request.headers.get_mut(row_idx) {
                                            h.enabled = !h.enabled;
                                            tab.is_dirty = true;
                                        }
                                    } else {
                                        if let Some(p) = tab.request.params.get_mut(row_idx) {
                                            p.enabled = !p.enabled;
                                            tab.is_dirty = true;
                                        }
                                    }
                                }
                                cx.notify();
                            });
                        })
                        .child(if is_enabled { "✓" } else { "" }),
                )
                // Key Column
                .child(
                    div()
                        .w(px(180.0))
                        .text_xs()
                        .text_color(if is_enabled {
                            theme.text_primary
                        } else {
                            theme.text_muted
                        })
                        .child(if item.key.is_empty() {
                            "Key".to_string()
                        } else {
                            item.key.clone()
                        }),
                )
                // Value Column
                .child(
                    div()
                        .w(px(240.0))
                        .text_xs()
                        .text_color(if is_enabled {
                            theme.text_secondary
                        } else {
                            theme.text_muted
                        })
                        .child(if item.value.is_empty() {
                            "Value".to_string()
                        } else {
                            item.value.clone()
                        }),
                )
                // Description Column
                .child(
                    div().flex_1().text_xs().text_color(theme.text_muted).child(
                        item.description
                            .clone()
                            .unwrap_or_else(|| "Description".to_string()),
                    ),
                )
                // Delete button
                .child(
                    div()
                        .id(ElementId::Name(
                            format!("kv-del-{}-{}", title, row_idx).into(),
                        ))
                        .w(px(24.0))
                        .h(px(24.0))
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded_sm()
                        .cursor_pointer()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.method_delete))
                        .on_click(move |_, _window, cx| {
                            view_delete.update(cx, |this, cx| {
                                if let Some(tab) = this.state.active_tab_mut() {
                                    if is_headers {
                                        tab.remove_header(row_idx);
                                    } else {
                                        tab.remove_param(row_idx);
                                    }
                                }
                                cx.notify();
                            });
                        })
                        .child("✕"),
                );

            table_content = table_content.child(row);
        }
    }

    // Add Row Button
    let add_btn = div().flex().items_center().pt_2().child(
        div()
            .id(ElementId::Name(format!("add-btn-{}", title).into()))
            .flex()
            .items_center()
            .gap_1p5()
            .px_3()
            .py_1()
            .rounded_sm()
            .text_xs()
            .text_color(theme.text_secondary)
            .cursor_pointer()
            .hover(|s| s.bg(theme.surface_hover).text_color(theme.primary))
            .on_click(move |_, _window, cx| {
                view_add.update(cx, |this, cx| {
                    if let Some(tab) = this.state.active_tab_mut() {
                        if is_headers {
                            tab.add_header();
                        } else {
                            tab.add_param();
                        }
                    }
                    cx.notify();
                });
            })
            .child("+ Add Row"),
    );

    table_content.child(add_btn)
}

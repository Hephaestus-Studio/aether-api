//! Unsaved Changes Confirmation Modal.
//!
//! Prompts the user before closing a dirty request tab with options to Save, Don't Save, or Cancel.

use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

#[derive(Debug, Clone)]
pub struct UnsavedModalState {
    pub is_open: bool,
    pub tab_index: usize,
    pub request_name: String,
}

impl UnsavedModalState {
    pub fn new() -> Self {
        Self {
            is_open: false,
            tab_index: 0,
            request_name: String::new(),
        }
    }

    pub fn prompt(&mut self, tab_index: usize, request_name: String) {
        self.is_open = true;
        self.tab_index = tab_index;
        self.request_name = request_name;
    }

    pub fn close(&mut self) {
        self.is_open = false;
        self.tab_index = 0;
        self.request_name.clear();
    }
}

/// Renders the unsaved changes warning dialog.
pub fn render_unsaved_modal(
    state: &UnsavedModalState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if !state.is_open {
        return div().id("unsaved-modal-closed");
    }

    let tab_idx = state.tab_index;
    let req_name = state.request_name.clone();
    let view_cancel = view.clone();
    let view_save = view.clone();
    let view_discard = view.clone();

    div()
        .id("unsaved-modal-backdrop")
        .absolute()
        .inset_0()
        .flex()
        .items_center()
        .justify_center()
        .bg(gpui::hsla(0.0, 0.0, 0.0, 0.65))
        .child(
            div()
                .id("unsaved-modal-card")
                .flex()
                .flex_col()
                .w(px(420.0))
                .p_5()
                .gap_4()
                .rounded_lg()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_3()
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_center()
                                .w(px(36.0))
                                .h(px(36.0))
                                .rounded_full()
                                .bg(hsla(38.0 / 360.0, 0.80, 0.50, 0.15))
                                .text_color(hsla(38.0 / 360.0, 0.90, 0.55, 1.0))
                                .text_base()
                                .font_weight(FontWeight::BOLD)
                                .child("⚠"),
                        )
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .child(
                                    div()
                                        .text_sm()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child("Unsaved Changes"),
                                )
                                .child(div().text_xs().text_color(theme.text_secondary).child(
                                    format!("Save changes to \"{}\" before closing?", req_name),
                                )),
                        ),
                )
                .child(div().text_xs().text_color(theme.text_muted).child(
                    "If you close without saving, your unsaved edits will be permanently lost.",
                ))
                .child(
                    div()
                        .flex()
                        .justify_end()
                        .items_center()
                        .gap_2()
                        .pt_2()
                        .child(
                            div()
                                .id("unsaved-modal-cancel-btn")
                                .px_3()
                                .py_1p5()
                                .rounded_sm()
                                .bg(theme.surface_hover)
                                .hover(|s| s.bg(theme.border))
                                .text_color(theme.text_primary)
                                .text_xs()
                                .cursor_pointer()
                                .on_click(move |_, _window, cx| {
                                    view_cancel.update(cx, |this, cx| {
                                        this.unsaved_modal_state.close();
                                        cx.notify();
                                    });
                                })
                                .child("Cancel"),
                        )
                        .child(
                            div()
                                .id("unsaved-modal-discard-btn")
                                .px_3()
                                .py_1p5()
                                .rounded_sm()
                                .bg(hsla(0.0, 0.70, 0.50, 0.15))
                                .hover(|s| s.bg(hsla(0.0, 0.70, 0.50, 0.25)))
                                .text_color(theme.error)
                                .text_xs()
                                .font_weight(FontWeight::MEDIUM)
                                .cursor_pointer()
                                .on_click(move |_, _window, cx| {
                                    view_discard.update(cx, |this, cx| {
                                        this.unsaved_modal_state.close();
                                        this.force_close_tab(tab_idx, cx);
                                    });
                                })
                                .child("Don't Save"),
                        )
                        .child(
                            div()
                                .id("unsaved-modal-save-btn")
                                .px_3()
                                .py_1p5()
                                .rounded_sm()
                                .bg(theme.primary)
                                .hover(|s| s.bg(theme.primary_hover))
                                .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .cursor_pointer()
                                .on_click(move |_, _window, cx| {
                                    view_save.update(cx, |this, cx| {
                                        this.unsaved_modal_state.close();
                                        this.save_tab_and_close(tab_idx, cx);
                                    });
                                })
                                .child("Save"),
                        ),
                ),
        )
}

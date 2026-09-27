//! 3-Way Merge Conflict Resolution Modal Component.
//!
//! Provides interactive conflict inspection (Ours vs Base vs Theirs)
//! and resolution actions (Accept Ours, Accept Theirs, Accept Both, Custom Merge).

use crate::components::text_area::TextArea;
use crate::models::git_state::GitState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the Conflict Resolution modal overlay if there is an active conflict file.
pub fn render_conflict_resolver(
    git_state: &GitState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    conflict_editor: Entity<TextArea>,
) -> impl IntoElement {
    let conflict = match &git_state.active_conflict {
        Some(c) => c.clone(),
        None => return div().id("empty-conflict-resolver"),
    };

    let view_close = view.clone();
    let view_accept_ours = view.clone();
    let view_accept_theirs = view.clone();
    let view_accept_both = view.clone();
    let view_resolve = view.clone();

    let ours_content = conflict.ours_content.clone();
    let theirs_content = conflict.theirs_content.clone();
    let base_content = conflict.base_content.clone();
    let path = conflict.path.clone();

    div()
        .id("conflict-resolver-overlay")
        .absolute()
        .inset_0()
        .bg(gpui::hsla(0.0, 0.0, 0.0, 0.75))
        .flex()
        .items_center()
        .justify_center()
        .child(
            div()
                .id("conflict-resolver-modal")
                .flex()
                .flex_col()
                .w(px(900.0))
                .h(px(640.0))
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded_lg()
                .shadow_xl()
                .overflow_hidden()
                // Top Header
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .h(px(46.0))
                        .px_4()
                        .bg(theme.surface_hover)
                        .border_b_1()
                        .border_color(theme.border)
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2()
                                .child(
                                    div()
                                        .text_base()
                                        .text_color(gpui::hsla(0.12, 0.90, 0.55, 1.0))
                                        .child("⚡"),
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
                                                .child("Resolve Merge Conflict"),
                                        )
                                        .child(
                                            div()
                                                .text_size(px(11.0))
                                                .font_family("monospace")
                                                .text_color(theme.text_muted)
                                                .child(path.clone()),
                                        ),
                                ),
                        )
                        .child(
                            div()
                                .id("btn-close-conflict-resolver")
                                .flex()
                                .items_center()
                                .justify_center()
                                .size(px(24.0))
                                .rounded_sm()
                                .text_color(theme.text_muted)
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.surface).text_color(theme.text_primary))
                                .on_click(move |_, _window, cx| {
                                    view_close.update(cx, |this, cx| {
                                        this.git_state.set_active_conflict(None);
                                        cx.notify();
                                    });
                                })
                                .child("✕"),
                        ),
                )
                // Quick Resolution Action Buttons Toolbar
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .px_4()
                        .py_2()
                        .bg(theme.surface)
                        .border_b_1()
                        .border_color(theme.border)
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2()
                                // Accept Current (Ours)
                                .child({
                                    let ours_str = ours_content.clone();
                                    let ed = conflict_editor.clone();
                                    div()
                                        .id("btn-accept-ours")
                                        .flex()
                                        .items_center()
                                        .gap_1p5()
                                        .px_2p5()
                                        .py_1()
                                        .rounded_sm()
                                        .bg(gpui::hsla(0.38, 0.60, 0.25, 0.35))
                                        .border_1()
                                        .border_color(gpui::hsla(0.38, 0.60, 0.45, 0.8))
                                        .text_color(gpui::hsla(0.38, 0.80, 0.70, 1.0))
                                        .text_size(px(11.0))
                                        .font_weight(FontWeight::BOLD)
                                        .cursor_pointer()
                                        .hover(|s| s.bg(gpui::hsla(0.38, 0.60, 0.35, 0.6)))
                                        .on_click(move |_, _window, cx| {
                                            let text = ours_str.clone();
                                            ed.update(cx, |input, cx| {
                                                input.set_value(&text, cx);
                                            });
                                            view_accept_ours.update(cx, |_this, cx| {
                                                cx.notify();
                                            });
                                        })
                                        .child("⬅ Accept Current (Ours)")
                                })
                                // Accept Incoming (Theirs)
                                .child({
                                    let theirs_str = theirs_content.clone();
                                    let ed = conflict_editor.clone();
                                    div()
                                        .id("btn-accept-theirs")
                                        .flex()
                                        .items_center()
                                        .gap_1p5()
                                        .px_2p5()
                                        .py_1()
                                        .rounded_sm()
                                        .bg(gpui::hsla(0.60, 0.60, 0.25, 0.35))
                                        .border_1()
                                        .border_color(gpui::hsla(0.60, 0.60, 0.45, 0.8))
                                        .text_color(gpui::hsla(0.60, 0.80, 0.70, 1.0))
                                        .text_size(px(11.0))
                                        .font_weight(FontWeight::BOLD)
                                        .cursor_pointer()
                                        .hover(|s| s.bg(gpui::hsla(0.60, 0.60, 0.35, 0.6)))
                                        .on_click(move |_, _window, cx| {
                                            let text = theirs_str.clone();
                                            ed.update(cx, |input, cx| {
                                                input.set_value(&text, cx);
                                            });
                                            view_accept_theirs.update(cx, |_this, cx| {
                                                cx.notify();
                                            });
                                        })
                                        .child("Accept Incoming (Theirs) ➡")
                                })
                                // Accept Both
                                .child({
                                    let combined =
                                        format!("{}\n\n{}", ours_content, theirs_content);
                                    let ed = conflict_editor.clone();
                                    div()
                                        .id("btn-accept-both")
                                        .flex()
                                        .items_center()
                                        .gap_1p5()
                                        .px_2p5()
                                        .py_1()
                                        .rounded_sm()
                                        .bg(theme.surface_hover)
                                        .border_1()
                                        .border_color(theme.border)
                                        .text_color(theme.text_primary)
                                        .text_size(px(11.0))
                                        .cursor_pointer()
                                        .hover(|s| s.bg(theme.border))
                                        .on_click(move |_, _window, cx| {
                                            let text = combined.clone();
                                            ed.update(cx, |input, cx| {
                                                input.set_value(&text, cx);
                                            });
                                            view_accept_both.update(cx, |_this, cx| {
                                                cx.notify();
                                            });
                                        })
                                        .child("Accept Both")
                                }),
                        )
                        .child(
                            div()
                                .text_size(px(11.0))
                                .text_color(theme.text_muted)
                                .child("Review and edit the merged result below"),
                        ),
                )
                // Split View: Comparison Panes on top, Merged Result Editor on bottom
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .flex_1()
                        .overflow_hidden()
                        // Comparison Panes (Ours vs Base vs Theirs)
                        .child(
                            div()
                                .flex()
                                .h(px(220.0))
                                .border_b_1()
                                .border_color(theme.border)
                                // Left: Ours (Local)
                                .child(
                                    div()
                                        .flex()
                                        .flex_col()
                                        .flex_1()
                                        .border_r_1()
                                        .border_color(theme.border)
                                        .bg(gpui::hsla(0.38, 0.30, 0.12, 0.3))
                                        .child(
                                            div()
                                                .flex()
                                                .items_center()
                                                .justify_between()
                                                .px_3()
                                                .py_1()
                                                .bg(gpui::hsla(0.38, 0.40, 0.15, 0.5))
                                                .border_b_1()
                                                .border_color(gpui::hsla(0.38, 0.40, 0.3, 0.4))
                                                .child(
                                                    div()
                                                        .text_size(px(10.0))
                                                        .font_weight(FontWeight::BOLD)
                                                        .text_color(gpui::hsla(
                                                            0.38, 0.80, 0.70, 1.0,
                                                        ))
                                                        .child("CURRENT CHANGE (OURS / HEAD)"),
                                                ),
                                        )
                                        .child(
                                            div()
                                                .flex_1()
                                                .overflow_y_hidden()
                                                .p_2()
                                                .text_size(px(11.0))
                                                .font_family("monospace")
                                                .text_color(theme.text_primary)
                                                .child(ours_content.clone()),
                                        ),
                                )
                                // Optional Middle: Base
                                .when_some(base_content.clone(), |this, base| {
                                    this.child(
                                        div()
                                            .flex()
                                            .flex_col()
                                            .flex_1()
                                            .border_r_1()
                                            .border_color(theme.border)
                                            .bg(theme.surface)
                                            .child(
                                                div()
                                                    .px_3()
                                                    .py_1()
                                                    .bg(theme.surface_hover)
                                                    .border_b_1()
                                                    .border_color(theme.border)
                                                    .child(
                                                        div()
                                                            .text_size(px(10.0))
                                                            .font_weight(FontWeight::BOLD)
                                                            .text_color(theme.text_muted)
                                                            .child("BASE (COMMON ANCESTOR)"),
                                                    ),
                                            )
                                            .child(
                                                div()
                                                    .flex_1()
                                                    .overflow_y_hidden()
                                                    .p_2()
                                                    .text_size(px(11.0))
                                                    .font_family("monospace")
                                                    .text_color(theme.text_muted)
                                                    .child(base),
                                            ),
                                    )
                                })
                                // Right: Theirs (Remote / Incoming)
                                .child(
                                    div()
                                        .flex()
                                        .flex_col()
                                        .flex_1()
                                        .bg(gpui::hsla(0.60, 0.30, 0.12, 0.3))
                                        .child(
                                            div()
                                                .flex()
                                                .items_center()
                                                .justify_between()
                                                .px_3()
                                                .py_1()
                                                .bg(gpui::hsla(0.60, 0.40, 0.15, 0.5))
                                                .border_b_1()
                                                .border_color(gpui::hsla(0.60, 0.40, 0.3, 0.4))
                                                .child(
                                                    div()
                                                        .text_size(px(10.0))
                                                        .font_weight(FontWeight::BOLD)
                                                        .text_color(gpui::hsla(
                                                            0.60, 0.80, 0.70, 1.0,
                                                        ))
                                                        .child("INCOMING CHANGE (THEIRS)"),
                                                ),
                                        )
                                        .child(
                                            div()
                                                .flex_1()
                                                .overflow_y_hidden()
                                                .p_2()
                                                .text_size(px(11.0))
                                                .font_family("monospace")
                                                .text_color(theme.text_primary)
                                                .child(theirs_content.clone()),
                                        ),
                                ),
                        )
                        // Bottom: Merged Result Editor
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .flex_1()
                                .p_3()
                                .gap_1()
                                .child(
                                    div()
                                        .text_size(px(11.0))
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_muted)
                                        .child("MERGED RESULT (EDITABLE):"),
                                )
                                .child(
                                    div()
                                        .flex_1()
                                        .border_1()
                                        .border_color(theme.border)
                                        .rounded_sm()
                                        .overflow_hidden()
                                        .child(conflict_editor.clone()),
                                ),
                        ),
                )
                // Modal Footer
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_end()
                        .gap_2()
                        .h(px(48.0))
                        .px_4()
                        .bg(theme.surface_hover)
                        .border_t_1()
                        .border_color(theme.border)
                        .child({
                            let view_cancel = view.clone();
                            div()
                                .id("btn-cancel-conflict")
                                .px_3()
                                .py_1p5()
                                .rounded_sm()
                                .bg(theme.surface)
                                .border_1()
                                .border_color(theme.border)
                                .text_color(theme.text_primary)
                                .text_xs()
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.surface_hover))
                                .on_click(move |_, _window, cx| {
                                    view_cancel.update(cx, |this, cx| {
                                        this.git_state.set_active_conflict(None);
                                        cx.notify();
                                    });
                                })
                                .child("Cancel")
                        })
                        .child({
                            let target_path = path.clone();
                            div()
                                .id("btn-save-conflict-resolve")
                                .px_4()
                                .py_1p5()
                                .rounded_sm()
                                .bg(theme.primary)
                                .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.primary_hover))
                                .on_click(move |_, _window, cx| {
                                    let file_path = target_path.clone();
                                    view_resolve.update(cx, |this, cx| {
                                        this.resolve_active_conflict(&file_path, cx);
                                    });
                                })
                                .child("✓ Save & Mark Resolved")
                        }),
                ),
        )
}

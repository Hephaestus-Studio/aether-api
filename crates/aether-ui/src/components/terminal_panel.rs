use crate::models::TerminalState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the embedded Multi-tab Terminal panel in the bottom workspace area.
pub fn render_terminal_panel(
    state: &TerminalState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if !state.is_visible {
        return div();
    }

    let view_new = view.clone();
    let view_close_panel = view.clone();

    let mut tab_headers = div()
        .flex()
        .items_center()
        .gap_1()
        .h(px(30.0))
        .px_2()
        .bg(theme.surface)
        .border_b_1()
        .border_color(theme.border);

    for (idx, tab) in state.tabs.iter().enumerate() {
        let is_active = idx == state.active_tab_index;
        let tab_idx = idx;
        let view_select = view.clone();
        let view_close_tab = view.clone();

        tab_headers = tab_headers.child(
            div()
                .id(ElementId::Name(format!("term-tab-{}", tab.id).into()))
                .flex()
                .items_center()
                .gap_1p5()
                .h(px(24.0))
                .px_2p5()
                .rounded_sm()
                .cursor_pointer()
                .when(is_active, |this| {
                    this.bg(theme.background)
                        .text_color(theme.text_primary)
                        .font_weight(FontWeight::BOLD)
                })
                .when(!is_active, |this| {
                    this.text_color(theme.text_secondary)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    view_select.update(cx, |this, cx| {
                        this.terminal_state.active_tab_index = tab_idx;
                        cx.notify();
                    });
                })
                .child(
                    div()
                        .text_size(px(10.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.primary)
                        .child(">_"),
                )
                .child(div().text_xs().child(tab.title.clone()))
                .child(
                    div()
                        .id(ElementId::Name(format!("term-close-{}", tab.id).into()))
                        .w(px(14.0))
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded_sm()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        .on_click(move |_, _window, cx| {
                            view_close_tab.update(cx, |this, cx| {
                                this.terminal_state.close_tab(tab_idx);
                                cx.notify();
                            });
                        })
                        .child("×"),
                ),
        );
    }

    // New Terminal Button
    tab_headers = tab_headers.child(
        div()
            .id("new-terminal-tab-btn")
            .flex()
            .items_center()
            .justify_center()
            .w(px(22.0))
            .h(px(22.0))
            .rounded_sm()
            .text_xs()
            .text_color(theme.text_muted)
            .cursor_pointer()
            .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
            .on_click(move |_, _window, cx| {
                view_new.update(cx, |this, cx| {
                    this.create_terminal_tab(cx);
                });
            })
            .child("+"),
    );

    // Close Panel button
    tab_headers = tab_headers.child(div().flex_1());
    tab_headers = tab_headers.child(
        div()
            .id("close-terminal-panel-btn")
            .px_2()
            .py_0p5()
            .rounded_sm()
            .text_xs()
            .text_color(theme.text_muted)
            .cursor_pointer()
            .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
            .on_click(move |_, _window, cx| {
                view_close_panel.update(cx, |this, cx| {
                    this.terminal_state.is_visible = false;
                    cx.notify();
                });
            })
            .child("Close"),
    );

    let active_tab = state.active_tab();

    let mut output_view = div()
        .flex()
        .flex_col()
        .flex_1()
        .p_3()
        .bg(theme.background)
        .overflow_y_hidden()
        .gap_1();

    if let Some(tab) = active_tab {
        for line in &tab.output_lines {
            output_view = output_view.child(
                div()
                    .text_xs()
                    .text_color(theme.text_secondary)
                    .child(line.clone()),
            );
        }
    }

    div()
        .flex()
        .flex_col()
        .h(px(220.0))
        .w_full()
        .border_t_1()
        .border_color(theme.border)
        .bg(theme.background)
        .child(tab_headers)
        .child(output_view)
}

use crate::components::method_badge::render_method_badge;
use crate::models::WorkspaceState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the horizontal Tab Bar with open request tabs.
pub fn render_tab_bar(
    state: &WorkspaceState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    let mut tab_strip = div()
        .flex()
        .items_center()
        .h(px(34.0))
        .w_full()
        .bg(theme.surface)
        .border_b_1()
        .border_color(theme.border)
        .overflow_x_hidden();

    if state.tabs.is_empty() {
        return tab_strip;
    }

    for (idx, tab) in state.tabs.iter().enumerate() {
        let is_active = idx == state.active_tab_index;
        let tab_idx = idx;
        let view_select = view.clone();
        let view_close = view.clone();
        let method_str = tab.request.method.to_string();

        let tab_element = div()
            .id(ElementId::Name(format!("tab-{}", tab.id).into()))
            .flex()
            .items_center()
            .gap_1p5()
            .h_full()
            .px_3()
            .border_r_1()
            .border_color(theme.border)
            .cursor_pointer()
            .when(is_active, |this| {
                this.bg(theme.background)
                    .border_b_2()
                    .border_color(theme.primary)
                    .text_color(theme.text_primary)
            })
            .when(!is_active, |this| {
                this.bg(theme.surface)
                    .text_color(theme.text_secondary)
                    .hover(|style| style.bg(theme.surface_hover).text_color(theme.text_primary))
            })
            .on_click(move |_, _window, cx| {
                view_select.update(cx, |this, cx| {
                    this.select_tab(tab_idx, cx);
                });
            })
            .child(render_method_badge(&method_str, theme))
            .child(
                div()
                    .text_xs()
                    .font_weight(if is_active {
                        FontWeight::BOLD
                    } else {
                        FontWeight::NORMAL
                    })
                    .child(tab.request.name.clone()),
            )
            // Dirty indicator or close button
            .child(
                div()
                    .id(ElementId::Name(format!("close-tab-{}", tab.id).into()))
                    .flex()
                    .items_center()
                    .justify_center()
                    .w(px(16.0))
                    .h(px(16.0))
                    .rounded_sm()
                    .hover(|style| style.bg(theme.surface_hover).text_color(theme.text_primary))
                    .on_click(move |_, _window, cx| {
                        view_close.update(cx, |this, cx| {
                            this.close_tab(tab_idx, cx);
                        });
                    })
                    .child(if tab.is_dirty {
                        div()
                            .text_size(px(10.0))
                            .text_color(theme.primary)
                            .child("●")
                    } else {
                        div().text_size(px(12.0)).child("×")
                    }),
            );

        tab_strip = tab_strip.child(tab_element);
    }

    tab_strip
}

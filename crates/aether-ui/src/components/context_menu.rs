//! Context Menu Component for GPUI.
//!
//! Renders a floating, auto-closing right-click popup overlay at cursor coordinates
//! with support for action icons, keyboard shortcut badges, separators, and destructive highlights.

use crate::models::ContextMenuState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the floating Context Menu popup.
pub fn render_context_menu(
    state: &ContextMenuState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if !state.is_open {
        return div();
    }

    let view_backdrop = view.clone();
    let pos_x = state.position.x;
    let pos_y = state.position.y;

    let mut menu_items = div().flex().flex_col().gap_0p5().p_1();

    for (idx, item) in state.items.iter().enumerate() {
        if item.is_separator {
            menu_items = menu_items.child(div().h(px(1.0)).my_1().bg(theme.border));
            continue;
        }

        let item_id = item.id.clone();
        let view_item = view.clone();
        let is_destructive = item.is_destructive;

        menu_items = menu_items.child(
            div()
                .id(ElementId::Name(format!("ctx-item-{}", idx).into()))
                .flex()
                .items_center()
                .justify_between()
                .px_2p5()
                .py_1p5()
                .rounded_sm()
                .cursor_pointer()
                .text_size(px(12.0))
                .when(!is_destructive, |s| {
                    s.text_color(theme.text_primary).hover(|h| {
                        h.bg(theme.surface_hover)
                            .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                    })
                })
                .when(is_destructive, |s| {
                    s.text_color(theme.error)
                        .hover(|h| h.bg(gpui::hsla(0.0, 0.70, 0.50, 0.15)))
                })
                .on_click(move |_, _window, cx| {
                    cx.stop_propagation();
                    let act_id = item_id.clone();
                    view_item.update(cx, |this, cx| {
                        this.execute_context_menu_action(&act_id, cx);
                    });
                })
                // Icon + Label
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        .when_some(item.icon.as_ref(), |s, icon| {
                            s.child(
                                div()
                                    .w(px(14.0))
                                    .text_size(px(11.0))
                                    .text_color(if is_destructive {
                                        theme.error
                                    } else {
                                        theme.text_muted
                                    })
                                    .child(icon.clone()),
                            )
                        })
                        .child(
                            div()
                                .font_weight(FontWeight::NORMAL)
                                .child(item.label.clone()),
                        ),
                )
                // Shortcut badge
                .when_some(item.shortcut.as_ref(), |s, sc| {
                    s.child(
                        div()
                            .text_size(px(10.0))
                            .text_color(theme.text_muted)
                            .child(sc.clone()),
                    )
                }),
        );
    }

    div()
        .absolute()
        .top_0()
        .left_0()
        .size_full()
        // Transparent Backdrop to dismiss on click outside
        .child(
            div()
                .id("context-menu-backdrop")
                .absolute()
                .top_0()
                .left_0()
                .size_full()
                .on_mouse_down(MouseButton::Left, move |_, _window, cx| {
                    view_backdrop.update(cx, |this, cx| {
                        this.context_menu_state.close();
                        cx.notify();
                    });
                })
                .on_mouse_down(MouseButton::Right, move |_, _window, cx| {
                    // Right clicking outside also dismisses
                    cx.stop_propagation();
                }),
        )
        // Floating Context Menu Card
        .child(
            div()
                .id("context-menu-card")
                .absolute()
                .left(pos_x)
                .top(pos_y)
                .min_w(px(180.0))
                .rounded_md()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                .child(menu_items),
        )
}

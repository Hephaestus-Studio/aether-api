use crate::components::method_badge::render_method_badge;
use crate::components::text_input::TextInput;
use crate::models::PickerState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the centered Command Palette / Quick Open Modal Dialog overlay.
pub fn render_command_palette(
    state: &PickerState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    picker_input: Entity<TextInput>,
) -> impl IntoElement {
    if !state.is_open {
        return div();
    }

    let view_backdrop = view.clone();
    let filtered_items = state.filtered_items();

    let mut items_list = div()
        .flex()
        .flex_col()
        .max_h(px(320.0))
        .overflow_y_hidden()
        .p_1()
        .gap_0p5();

    if filtered_items.is_empty() {
        items_list = items_list.child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .py_6()
                .text_xs()
                .text_color(theme.text_muted)
                .child("No matching results found"),
        );
    } else {
        for (idx, item) in filtered_items.iter().enumerate() {
            let item_idx = idx;
            let item_id = item.id.clone();
            let is_selected = item_idx == state.selected_index;
            let view_item = view.clone();

            let row = div()
                .id(ElementId::Name(format!("picker-item-{}", item.id).into()))
                .flex()
                .items_center()
                .justify_between()
                .h(px(34.0))
                .px_3()
                .rounded_sm()
                .cursor_pointer()
                .when(is_selected, |this| {
                    this.bg(theme.surface_hover).text_color(theme.text_primary)
                })
                .when(!is_selected, |this| {
                    this.text_color(theme.text_secondary)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    let item_id = item_id.clone();
                    view_item.update(cx, |this, cx| {
                        this.execute_picker_item(&item_id, cx);
                    });
                })
                // Left: Badge / Icon + Title & Subtitle
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        .when_some(item.badge.as_ref(), |this, badge| {
                            this.child(render_method_badge(badge, theme))
                        })
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .child(
                                    div()
                                        .text_xs()
                                        .font_weight(if is_selected {
                                            FontWeight::BOLD
                                        } else {
                                            FontWeight::NORMAL
                                        })
                                        .child(item.title.clone()),
                                )
                                .when_some(item.subtitle.as_ref(), |this, sub| {
                                    this.child(
                                        div()
                                            .text_size(px(10.0))
                                            .text_color(theme.text_muted)
                                            .child(sub.clone()),
                                    )
                                }),
                        ),
                )
                // Right: Shortcut badge
                .when_some(item.shortcut.as_ref(), |this, sc| {
                    this.child(
                        div()
                            .px_1p5()
                            .py_0p5()
                            .rounded_sm()
                            .bg(theme.surface)
                            .border_1()
                            .border_color(theme.border)
                            .text_size(px(10.0))
                            .text_color(theme.text_muted)
                            .child(sc.clone()),
                    )
                });

            items_list = items_list.child(row);
        }
    }

    // Modal Box centered over screen
    div()
        .absolute()
        .top_0()
        .left_0()
        .size_full()
        .flex()
        .items_start()
        .justify_center()
        .pt(px(80.0))
        // Backdrop overlay
        .child(
            div()
                .id("palette-backdrop")
                .absolute()
                .top_0()
                .left_0()
                .size_full()
                .bg(hsla(0.0, 0.0, 0.0, 0.5))
                .on_click(move |_, _window, cx| {
                    view_backdrop.update(cx, |this, cx| {
                        this.picker_state.close();
                        cx.notify();
                    });
                }),
        )
        // Dialog Panel
        .child(
            div()
                .id("palette-dialog")
                .relative()
                .on_mouse_down(MouseButton::Left, |_event, _window, cx| {
                    cx.stop_propagation();
                })
                .flex()
                .flex_col()
                .w(px(560.0))
                .rounded_md()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                // Search Input Header
                .child(
                    div()
                        .flex()
                        .items_center()
                        .h(px(42.0))
                        .px_3()
                        .border_b_1()
                        .border_color(theme.border)
                        .gap_2()
                        .child(div().text_xs().text_color(theme.text_muted).child(">"))
                        .child(div().flex_1().child(picker_input)),
                )
                // Filtered List
                .child(items_list)
                // Modal Footer
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .h(px(26.0))
                        .px_3()
                        .border_t_1()
                        .border_color(theme.border)
                        .text_size(px(10.0))
                        .text_color(theme.text_muted)
                        .child(div().child("Arrows to navigate | Enter to select | Esc to close"))
                        .child(div().child(format!("{} items", filtered_items.len()))),
                ),
        )
}

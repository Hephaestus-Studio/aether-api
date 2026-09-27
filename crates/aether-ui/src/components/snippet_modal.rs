use crate::models::{RequestTabState, SnippetModalState};
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::engine::snippet_generator::{generate_snippet, SnippetLanguage};
use gpui::prelude::*;
use gpui::*;

/// Renders the Instant Code Snippet Generator Modal dialog.
pub fn render_snippet_modal(
    state: &SnippetModalState,
    tab: Option<&RequestTabState>,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if !state.is_open {
        return div();
    }

    let tab = match tab {
        Some(t) => t,
        None => return div(),
    };

    let view_backdrop = view.clone();
    let current_lang = state.language();
    let snippet_code = generate_snippet(&tab.request, current_lang);

    let mut lang_buttons = div().flex().items_center().gap_1();

    for lang in SnippetLanguage::all() {
        let is_selected = *lang == current_lang;
        let lang_val = *lang;
        let view_lang = view.clone();

        lang_buttons = lang_buttons.child(
            div()
                .id(ElementId::Name(format!("lang-btn-{}", lang.name()).into()))
                .px_2p5()
                .py_1()
                .rounded_sm()
                .text_xs()
                .cursor_pointer()
                .when(is_selected, |this| {
                    this.bg(theme.surface_hover)
                        .text_color(theme.primary)
                        .font_weight(FontWeight::BOLD)
                })
                .when(!is_selected, |this| {
                    this.text_color(theme.text_secondary)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    view_lang.update(cx, |this, cx| {
                        this.snippet_modal_state.selected_language = Some(lang_val);
                        cx.notify();
                    });
                })
                .child(lang.name()),
        );
    }

    div()
        .absolute()
        .top_0()
        .left_0()
        .size_full()
        .flex()
        .items_center()
        .justify_center()
        // Backdrop overlay
        .child(
            div()
                .id("snippet-backdrop")
                .absolute()
                .top_0()
                .left_0()
                .size_full()
                .bg(hsla(0.0, 0.0, 0.0, 0.5))
                .on_click(move |_, _window, cx| {
                    view_backdrop.update(cx, |this, cx| {
                        this.snippet_modal_state.close();
                        cx.notify();
                    });
                }),
        )
        // Dialog Box
        .child(
            div()
                .id("snippet-dialog")
                .relative()
                .on_mouse_down(MouseButton::Left, |_event, _window, cx| {
                    cx.stop_propagation();
                })
                .flex()
                .flex_col()
                .w(px(640.0))
                .max_h(px(480.0))
                .rounded_md()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                // Modal Header
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .h(px(40.0))
                        .px_4()
                        .border_b_1()
                        .border_color(theme.border)
                        .child(
                            div()
                                .text_sm()
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.text_primary)
                                .child("Code Snippet Generator"),
                        )
                        .child(
                            div()
                                .id("close-snippet-btn")
                                .px_2()
                                .py_0p5()
                                .rounded_sm()
                                .text_xs()
                                .text_color(theme.text_muted)
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                .on_click({
                                    let view = view.clone();
                                    move |_, _window, cx| {
                                        view.update(cx, |this, cx| {
                                            this.snippet_modal_state.close();
                                            cx.notify();
                                        });
                                    }
                                })
                                .child("Close"),
                        ),
                )
                // Language Switcher Tabs
                .child(
                    div()
                        .px_4()
                        .py_2()
                        .border_b_1()
                        .border_color(theme.border)
                        .child(lang_buttons),
                )
                // Code Block Area
                .child(
                    div().flex_1().p_4().overflow_y_hidden().child(
                        div()
                            .p_3()
                            .rounded_sm()
                            .bg(theme.background)
                            .border_1()
                            .border_color(theme.border)
                            .text_xs()
                            .text_color(theme.text_primary)
                            .child(snippet_code),
                    ),
                )
                // Modal Footer
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .h(px(36.0))
                        .px_4()
                        .border_t_1()
                        .border_color(theme.border)
                        .child(
                            div()
                                .text_xs()
                                .text_color(theme.text_muted)
                                .child("Ready to paste into your project codebase"),
                        ),
                ),
        )
}

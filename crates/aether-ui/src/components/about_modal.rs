//! About Modal Component.
//!
//! Displays application branding, version, license, and architectural highlights.

use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the About AetherAPI modal.
pub fn render_about_modal(
    is_open: bool,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if !is_open {
        return div().id("about-modal-closed");
    }

    let view_close = view.clone();
    let view_btn_close = view.clone();

    div()
        .id("about-modal-backdrop")
        .absolute()
        .inset_0()
        .flex()
        .items_center()
        .justify_center()
        .bg(gpui::hsla(0.0, 0.0, 0.0, 0.65))
        .on_mouse_down(MouseButton::Left, move |_, _window, cx| {
            view_close.update(cx, |this, cx| {
                this.close_about_modal(cx);
            });
        })
        .child(
            div()
                .id("about-modal-card")
                .on_mouse_down(MouseButton::Left, |_, _window, cx| {
                    cx.stop_propagation();
                })
                .flex()
                .flex_col()
                .w(px(460.0))
                .p_6()
                .gap_4()
                .rounded_lg()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                // Header with Logo and App Name
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
                                .w(px(44.0))
                                .h(px(44.0))
                                .rounded_md()
                                .bg(theme.primary)
                                .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                .text_xl()
                                .font_weight(FontWeight::BOLD)
                                .child("⚡"),
                        )
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .child(
                                    div()
                                        .text_lg()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child("Aether API"),
                                )
                                .child(
                                    div()
                                        .text_xs()
                                        .text_color(theme.text_secondary)
                                        .child("High-Performance Native Rust API Studio (GPUI)"),
                                ),
                        ),
                )
                // App Info & Version
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap_1p5()
                        .p_3()
                        .rounded_sm()
                        .bg(theme.background)
                        .border_1()
                        .border_color(theme.border)
                        .child(
                            div()
                                .flex()
                                .justify_between()
                                .text_xs()
                                .child(div().text_color(theme.text_muted).child("Version"))
                                .child(
                                    div()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child("v0.1.0-native"),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .justify_between()
                                .text_xs()
                                .child(div().text_color(theme.text_muted).child("GUI Engine"))
                                .child(
                                    div()
                                        .text_color(theme.text_primary)
                                        .child("GPUI (Zed Foundation)"),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .justify_between()
                                .text_xs()
                                .child(div().text_color(theme.text_muted).child("License"))
                                .child(div().text_color(theme.text_primary).child("MIT License")),
                        )
                        .child(
                            div()
                                .flex()
                                .justify_between()
                                .text_xs()
                                .child(div().text_color(theme.text_muted).child("Architecture"))
                                .child(
                                    div()
                                        .text_color(theme.text_primary)
                                        .child("Git-First, Spec-Compliant YAML"),
                                ),
                        ),
                )
                // Features summary
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap_1()
                        .text_xs()
                        .text_color(theme.text_secondary)
                        .child("• Native multi-protocol support (HTTP, SSE, WebSocket)")
                        .child("• ChaCha20-Poly1305 encrypted Master Key secrets vault")
                        .child("• Embedded Git source control with 3-way merge conflict resolution")
                        .child("• Fast, zero-overhead embedded terminal integration"),
                )
                // Footer
                .child(
                    div().flex().justify_end().pt_2().child(
                        div()
                            .id("about-modal-close-btn")
                            .px_4()
                            .py_1p5()
                            .rounded_sm()
                            .bg(theme.primary)
                            .hover(|s| s.bg(theme.primary_hover))
                            .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                            .text_xs()
                            .font_weight(FontWeight::BOLD)
                            .cursor_pointer()
                            .on_click(move |_, _window, cx| {
                                view_btn_close.update(cx, |this, cx| {
                                    this.close_about_modal(cx);
                                });
                            })
                            .child("Close"),
                    ),
                ),
        )
}

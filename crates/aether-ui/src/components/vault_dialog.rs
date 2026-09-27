use crate::models::VaultState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the Unlock Workspace Secrets Dialog modal for AES-256-GCM encrypted environment variables.
pub fn render_vault_dialog(
    state: &VaultState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if !state.is_dialog_open {
        return div();
    }

    let view_backdrop = view.clone();
    let view_unlock = view.clone();
    let view_cancel = view.clone();
    let view_close = view.clone();
    let view_toggle_show = view.clone();

    let is_input_empty = state.master_key_input.is_empty();
    let show_password = state.show_password;

    let display_value = if is_input_empty {
        "Enter your workspace Master Key or Passphrase".to_string()
    } else if show_password {
        format!("{}|", state.master_key_input)
    } else {
        format!("{}|", "•".repeat(state.master_key_input.chars().count()))
    };

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
                .id("vault-backdrop")
                .absolute()
                .top_0()
                .left_0()
                .size_full()
                .bg(hsla(0.0, 0.0, 0.0, 0.6))
                .on_click(move |_, _window, cx| {
                    view_backdrop.update(cx, |this, cx| {
                        this.vault_state.close_dialog();
                        cx.notify();
                    });
                }),
        )
        // Dialog Card
        .child(
            div()
                .id("vault-dialog-card")
                .relative()
                .on_mouse_down(MouseButton::Left, |_event, _window, cx| {
                    cx.stop_propagation();
                })
                .flex()
                .flex_col()
                .w(px(500.0))
                .rounded_lg()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                .p_5()
                .gap_4()
                // Modal Header
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2p5()
                                // Yellow Shield Icon
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .justify_center()
                                        .size(px(24.0))
                                        .rounded_md()
                                        .bg(gpui::hsla(45.0, 0.95, 0.50, 0.15))
                                        .text_color(gpui::hsla(45.0, 0.95, 0.50, 1.0))
                                        .text_size(px(14.0))
                                        .font_weight(FontWeight::BOLD)
                                        .child("🛡"),
                                )
                                .child(
                                    div()
                                        .text_sm()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child("Unlock Workspace Secrets"),
                                ),
                        )
                        // Close button (X)
                        .child(
                            div()
                                .id("close-vault-modal-btn")
                                .flex()
                                .items_center()
                                .justify_center()
                                .size(px(24.0))
                                .rounded_sm()
                                .text_xs()
                                .text_color(theme.text_muted)
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                .on_click(move |_, _window, cx| {
                                    view_close.update(cx, |this, cx| {
                                        this.vault_state.close_dialog();
                                        cx.notify();
                                    });
                                })
                                .child("✕"),
                        ),
                )
                // Information Callout Banner
                .child(
                    div()
                        .flex()
                        .items_start()
                        .gap_3()
                        .p_3()
                        .rounded_md()
                        .bg(hsla(220.0, 0.20, 0.12, 1.0))
                        .border_1()
                        .border_color(theme.border)
                        // Key Icon
                        .child(
                            div()
                                .pt_0p5()
                                .text_color(gpui::hsla(45.0, 0.95, 0.50, 1.0))
                                .text_sm()
                                .child("🔑"),
                        )
                        // Explanation Text
                        .child(
                            div()
                                .flex_1()
                                .text_xs()
                                .text_color(theme.text_secondary)
                                .child(
                                    div()
                                        .flex()
                                        .flex_wrap()
                                        .gap_1()
                                        .child("This workspace contains secret variables encrypted with")
                                        .child(
                                            div()
                                                .font_weight(FontWeight::BOLD)
                                                .text_color(theme.text_primary)
                                                .child("AES-256-GCM."),
                                        )
                                        .child("Enter the Master Key or Passphrase to unlock and access them for this session."),
                                ),
                        ),
                )
                // Master Key / Passphrase Input Section
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap_1p5()
                        // Field Label
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_1()
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.text_primary)
                                .child("Master Key / Passphrase")
                                .child(
                                    div()
                                        .text_color(gpui::hsla(0.0, 0.85, 0.60, 1.0))
                                        .child("*"),
                                ),
                        )
                        // Input Field Box
                        .child({
                            let view_focus = view.clone();
                            div()
                                .id("vault-passphrase-input-container")
                                .cursor_text()
                                .on_mouse_down(MouseButton::Left, move |_event, window, cx| {
                                    cx.stop_propagation();
                                    view_focus.update(cx, |this, _cx| {
                                        window.focus(&this.focus_handle);
                                    });
                                })
                                .flex()
                                .items_center()
                                .justify_between()
                                .h(px(38.0))
                                .px_3()
                                .bg(theme.background)
                                .border_1()
                                .border_color(theme.primary)
                                .rounded_md()
                                // Passphrase text or placeholder
                                .child(
                                    div()
                                        .flex_1()
                                        .text_xs()
                                        .text_color(if is_input_empty {
                                            theme.text_muted
                                        } else {
                                            theme.text_primary
                                        })
                                        .child(display_value),
                                )
                                // Eye toggle icon button
                                .child(
                                    div()
                                        .id("vault-toggle-eye-btn")
                                        .flex()
                                        .items_center()
                                        .justify_center()
                                        .px_1p5()
                                        .py_1()
                                        .rounded_sm()
                                        .text_xs()
                                        .cursor_pointer()
                                        .text_color(theme.text_muted)
                                        .hover(|s| s.text_color(theme.text_primary))
                                        .on_click(move |_, _window, cx| {
                                            view_toggle_show.update(cx, |this, cx| {
                                                this.vault_state.toggle_show_password();
                                                cx.notify();
                                            });
                                        })
                                        .child(if show_password { "👁" } else { "👁‍🗨" }),
                                )
                        })
                )
                // Optional Error Banner
                .when_some(state.error_message.as_ref(), |this, err| {
                    this.child(
                        div()
                            .p_2()
                            .rounded_sm()
                            .bg(gpui::hsla(0.0, 0.85, 0.55, 0.15))
                            .border_1()
                            .border_color(theme.method_delete)
                            .text_xs()
                            .text_color(theme.method_delete)
                            .child(err.clone()),
                    )
                })
                // Action Buttons (Cancel / Unlock Secrets)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_end()
                        .gap_2p5()
                        .pt_2()
                        // Cancel Button
                        .child(
                            div()
                                .id("cancel-vault-btn")
                                .px_4()
                                .py_2()
                                .rounded_md()
                                .bg(theme.surface_hover)
                                .text_xs()
                                .font_weight(FontWeight::MEDIUM)
                                .text_color(theme.text_secondary)
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.border).text_color(theme.text_primary))
                                .on_click(move |_, _window, cx| {
                                    view_cancel.update(cx, |this, cx| {
                                        this.vault_state.close_dialog();
                                        cx.notify();
                                    });
                                })
                                .child("Cancel"),
                        )
                        // Unlock Secrets Button
                        .child(
                            div()
                                .id("unlock-vault-submit-btn")
                                .px_4()
                                .py_2()
                                .rounded_md()
                                .bg(theme.primary)
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.primary_hover))
                                .on_click(move |_, _window, cx| {
                                    view_unlock.update(cx, |this, cx| {
                                        this.unlock_vault(cx);
                                    });
                                })
                                .child("Unlock Secrets"),
                        ),
                ),
        )
}

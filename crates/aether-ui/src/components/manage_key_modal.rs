//! Master Key Management Modal for AES-256-GCM Secrets Encryption.
//!
//! Allows creating, changing, or removing the master passphrase used
//! to encrypt environment secret variables.

use crate::components::text_input::TextInput;
use crate::models::{EnvironmentState, VaultState};
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the Master Key Management Modal.
pub fn render_manage_key_modal(
    env_state: &EnvironmentState,
    vault_state: &VaultState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    key_input: Entity<TextInput>,
) -> impl IntoElement {
    if !env_state.is_manage_key_modal_open {
        return div();
    }

    let view_backdrop = view.clone();
    let view_close = view.clone();
    let view_save = view.clone();
    let view_remove = view.clone();
    let is_unlocked = vault_state.is_unlocked;

    div()
        .absolute()
        .top_0()
        .left_0()
        .size_full()
        .flex()
        .items_center()
        .justify_center()
        // Backdrop
        .child(
            div()
                .id("manage-key-backdrop")
                .absolute()
                .top_0()
                .left_0()
                .size_full()
                .bg(hsla(0.0, 0.0, 0.0, 0.6))
                .on_click(move |_, _window, cx| {
                    view_backdrop.update(cx, |this, cx| {
                        this.env_state.is_manage_key_modal_open = false;
                        cx.notify();
                    });
                }),
        )
        // Dialog Card
        .child(
            div()
                .id("manage-key-card")
                .relative()
                .on_mouse_down(MouseButton::Left, |_event, _window, cx| {
                    cx.stop_propagation();
                })
                .flex()
                .flex_col()
                .w(px(480.0))
                .rounded_lg()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                .p_5()
                .gap_4()
                // Header
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
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .justify_center()
                                        .size(px(26.0))
                                        .rounded_md()
                                        .bg(hsla(45.0, 0.95, 0.50, 0.15))
                                        .text_color(hsla(45.0, 0.95, 0.50, 1.0))
                                        .text_size(px(14.0))
                                        .child("🔐"),
                                )
                                .child(
                                    div()
                                        .text_size(px(15.0))
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child(if is_unlocked {
                                            "Manage Master Encryption Key"
                                        } else {
                                            "Set Master Encryption Key"
                                        }),
                                ),
                        )
                        .child(
                            div()
                                .id("manage-key-close-btn")
                                .flex()
                                .items_center()
                                .justify_center()
                                .size(px(24.0))
                                .rounded_sm()
                                .cursor_pointer()
                                .text_size(px(12.0))
                                .text_color(theme.text_muted)
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                .on_click(move |_, _window, cx| {
                                    view_close.update(cx, |this, cx| {
                                        this.env_state.is_manage_key_modal_open = false;
                                        cx.notify();
                                    });
                                })
                                .child("✕"),
                        ),
                )
                // Info callout
                .child(
                    div()
                        .p_3()
                        .rounded_md()
                        .bg(hsla(220.0, 0.20, 0.12, 1.0))
                        .border_1()
                        .border_color(theme.border)
                        .text_size(px(12.0))
                        .text_color(theme.text_secondary)
                        .child(
                            "The Master Key is used to derive a 256-bit AES key via PBKDF2 (100,000 rounds). Secret variables are encrypted with AES-256-GCM authenticated cipher before saving to disk."
                        ),
                )
                // Passphrase Input Field
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap_1p5()
                        .child(
                            div()
                                .text_size(px(12.0))
                                .font_weight(FontWeight::MEDIUM)
                                .text_color(theme.text_secondary)
                                .child("Passphrase / Master Key"),
                        )
                        .child(key_input),
                )
                // Actions Footer
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .pt_2()
                        .border_t_1()
                        .border_color(theme.border)
                        .child(
                            div().when(is_unlocked, |s| {
                                s.child(
                                    div()
                                        .id("remove-key-btn")
                                        .px_3()
                                        .py_1p5()
                                        .rounded_md()
                                        .cursor_pointer()
                                        .text_size(px(12.0))
                                        .font_weight(FontWeight::MEDIUM)
                                        .text_color(theme.error)
                                        .hover(|s| s.bg(hsla(0.0, 0.70, 0.50, 0.15)))
                                        .on_click(move |_, _window, cx| {
                                            view_remove.update(cx, |this, cx| {
                                                this.vault_state.lock();
                                                this.env_state.is_manage_key_modal_open = false;
                                                cx.notify();
                                            });
                                        })
                                        .child("Lock & Clear Key"),
                                )
                            }),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2()
                                .child(
                                    div()
                                        .id("save-key-btn")
                                        .px_4()
                                        .py_1p5()
                                        .rounded_md()
                                        .cursor_pointer()
                                        .bg(theme.primary)
                                        .text_color(theme.surface)
                                        .text_size(px(12.0))
                                        .font_weight(FontWeight::BOLD)
                                        .hover(|s| s.opacity(0.9))
                                        .on_click(move |_, _window, cx| {
                                            view_save.update(cx, |this, cx| {
                                                let pass = this.vault_input.read(cx).value().to_string();
                                                if !pass.trim().is_empty() {
                                                    let ws_salt = this.state.workspace_salt.as_deref();
                                                    let _ = this.vault_state.unlock(&pass, ws_salt, &[]);
                                                }
                                                this.env_state.is_manage_key_modal_open = false;
                                                cx.notify();
                                            });
                                        })
                                        .child("Save & Apply"),
                                ),
                        ),
                ),
        )
}

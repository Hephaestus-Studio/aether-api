//! Environment & Secrets Management Panel.
//!
//! Provides multi-environment configuration (Global, Dev, Staging, Prod, Custom),
//! interactive key-value editing with Secret masking & AES-256-GCM encryption,
//! active environment selection, and quick-add variable workflows.

use crate::models::environment_state::EnvironmentState;
use crate::models::VaultState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::environment::VariableType;
use gpui::prelude::*;
use gpui::*;

/// Renders the Environment & Secrets Management Panel.
pub fn render_environment_panel(
    env_state: &EnvironmentState,
    vault_state: &VaultState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    let view_add_env = view.clone();
    let view_key = view.clone();
    let view_save = view.clone();
    let view_add_var = view.clone();

    let selected_idx = env_state.selected_env_index;
    let selected_entry = env_state.selected_entry();
    let is_unlocked = vault_state.is_unlocked;

    // --- Left Sidebar: Environments List ---
    let mut env_list = div().flex().flex_col().gap_0p5().p_2();

    for (idx, entry) in env_state.entries.iter().enumerate() {
        let is_selected = idx == selected_idx;
        let is_active = env_state.active_env_index == Some(idx);
        let view_item = view.clone();
        let view_del = view.clone();
        let is_global = entry.environment.name.eq_ignore_ascii_case("global");
        let var_count = entry.environment.variables.len();

        env_list = env_list.child(
            div()
                .id(ElementId::Name(format!("env-item-{}", idx).into()))
                .group(format!("env-item-group-{}", idx))
                .flex()
                .items_center()
                .justify_between()
                .px_2p5()
                .py_1p5()
                .rounded_md()
                .cursor_pointer()
                .when(is_selected, |s| s.bg(theme.surface_hover))
                .when(!is_selected, |s| {
                    s.hover(|h| h.bg(theme.surface_hover.opacity(0.5)))
                })
                .on_click(move |_, _window, cx| {
                    view_item.update(cx, |this, cx| {
                        this.env_state.selected_env_index = idx;
                        cx.notify();
                    });
                })
                // Name + icons
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        .child(div().text_size(px(12.0)).child(if is_global {
                            "🌐"
                        } else {
                            "📦"
                        }))
                        .child(
                            div()
                                .text_size(px(12.0))
                                .font_weight(if is_selected {
                                    FontWeight::BOLD
                                } else {
                                    FontWeight::NORMAL
                                })
                                .text_color(if is_selected {
                                    theme.text_primary
                                } else {
                                    theme.text_secondary
                                })
                                .child(entry.environment.name.clone()),
                        )
                        .when(entry.is_dirty, |s| {
                            s.child(div().size(px(6.0)).rounded_full().bg(theme.primary))
                        }),
                )
                // Right badges & actions
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        // Active indicator badge
                        .when(is_active, |s| {
                            s.child(
                                div()
                                    .px_1p5()
                                    .py_0p5()
                                    .rounded_sm()
                                    .bg(gpui::hsla(142.0, 0.70, 0.45, 0.20))
                                    .text_color(gpui::hsla(142.0, 0.70, 0.45, 1.0))
                                    .text_size(px(10.0))
                                    .font_weight(FontWeight::BOLD)
                                    .child("ACTIVE"),
                            )
                        })
                        // Variable count
                        .child(
                            div()
                                .text_size(px(10.0))
                                .text_color(theme.text_muted)
                                .child(format!("{}", var_count)),
                        )
                        // Delete button (non-global)
                        .when(!is_global, |s| {
                            s.child(
                                div()
                                    .id(ElementId::Name(format!("del-env-{}", idx).into()))
                                    .px_1()
                                    .rounded_sm()
                                    .cursor_pointer()
                                    .text_size(px(11.0))
                                    .text_color(theme.text_muted)
                                    .hover(|h| h.text_color(theme.error))
                                    .on_click(move |_, _window, cx| {
                                        cx.stop_propagation();
                                        view_del.update(cx, |this, cx| {
                                            let _ = this.env_state.delete_environment(idx);
                                            cx.notify();
                                        });
                                    })
                                    .child("✕"),
                            )
                        }),
                ),
        );
    }

    let left_sidebar = div()
        .flex()
        .flex_col()
        .w(px(240.0))
        .h_full()
        .bg(theme.surface)
        .border_r_1()
        .border_color(theme.border)
        // Sidebar Header
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .h(px(36.0))
                .px_3()
                .border_b_1()
                .border_color(theme.border)
                .child(
                    div()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.text_muted)
                        .child("ENVIRONMENTS"),
                )
                .child(
                    div()
                        .id("add-env-btn")
                        .px_2()
                        .py_0p5()
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.primary)
                        .hover(|s| s.bg(theme.surface_hover))
                        .on_click(move |_, _window, cx| {
                            view_add_env.update(cx, |this, cx| {
                                if let Some(root) = this.state.workspace_root.clone() {
                                    let count = this.env_state.entries.len();
                                    let name = format!("Environment {}", count + 1);
                                    let _ = this.env_state.create_environment(&name, &root);
                                }
                                cx.notify();
                            });
                        })
                        .child("+ New"),
                ),
        )
        // Environments list
        .child(div().flex_1().overflow_y_hidden().child(env_list))
        // Vault / Secrets Key Status Footer
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .p_2p5()
                .border_t_1()
                .border_color(theme.border)
                .bg(theme.surface)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .child(div().text_size(px(12.0)).child(if is_unlocked {
                            "🔓"
                        } else {
                            "🔒"
                        }))
                        .child(
                            div()
                                .text_size(px(11.0))
                                .text_color(if is_unlocked {
                                    gpui::hsla(142.0, 0.70, 0.45, 1.0)
                                } else {
                                    theme.text_muted
                                })
                                .child(if is_unlocked {
                                    "Vault Unlocked"
                                } else {
                                    "Vault Locked"
                                }),
                        ),
                )
                .child(
                    div()
                        .id("manage-vault-btn")
                        .px_2()
                        .py_0p5()
                        .rounded_sm()
                        .cursor_pointer()
                        .text_size(px(10.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.primary)
                        .hover(|s| s.bg(theme.surface_hover))
                        .on_click(move |_, _window, cx| {
                            view_key.update(cx, |this, cx| {
                                this.env_state.is_manage_key_modal_open = true;
                                cx.notify();
                            });
                        })
                        .child(if is_unlocked { "Manage Key" } else { "Unlock" }),
                ),
        );

    // --- Right Main Area: Selected Environment Editor ---
    let right_content = match selected_entry {
        None => div()
            .flex()
            .flex_col()
            .flex_1()
            .items_center()
            .justify_center()
            .text_color(theme.text_muted)
            .child("No environment selected"),
        Some(entry) => {
            let env_name = entry.environment.name.clone();
            let is_active = env_state.active_env_index == Some(selected_idx);
            let is_dirty = entry.is_dirty;
            let view_set_active = view.clone();

            let mut var_rows = div().flex().flex_col().w_full();

            for (v_idx, var) in entry.environment.variables.iter().enumerate() {
                let view_toggle = view.clone();
                let view_del_var = view.clone();
                let view_type_toggle = view.clone();
                let var_name = var.name.clone();
                let var_val = var.value.clone();
                let is_secret = var.var_type == VariableType::Secret;
                let is_enabled = var.enabled;

                let display_value = if is_secret {
                    if is_unlocked {
                        if var_val.starts_with("enc:aes-gcm:") {
                            "●●●●●●●● (Encrypted)".to_string()
                        } else {
                            var_val.clone()
                        }
                    } else {
                        "●●●●●●●● (Locked)".to_string()
                    }
                } else {
                    var_val.clone()
                };

                var_rows = var_rows.child(
                    div()
                        .id(ElementId::Name(format!("var-row-{}", v_idx).into()))
                        .flex()
                        .items_center()
                        .gap_2()
                        .px_3()
                        .py_1p5()
                        .border_b_1()
                        .border_color(theme.border)
                        .hover(|s| s.bg(theme.surface_hover.opacity(0.3)))
                        // Checkbox
                        .child(
                            div()
                                .id(ElementId::Name(format!("var-chk-{}", v_idx).into()))
                                .cursor_pointer()
                                .text_size(px(12.0))
                                .text_color(if is_enabled {
                                    theme.primary
                                } else {
                                    theme.text_muted
                                })
                                .on_click(move |_, _window, cx| {
                                    view_toggle.update(cx, |this, cx| {
                                        if let Some(entry) = this.env_state.selected_entry_mut() {
                                            if let Some(v) =
                                                entry.environment.variables.get_mut(v_idx)
                                            {
                                                v.enabled = !v.enabled;
                                                entry.is_dirty = true;
                                            }
                                        }
                                        cx.notify();
                                    });
                                })
                                .child(if is_enabled { "☑" } else { "☐" }),
                        )
                        // Variable Name
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .w(px(200.0))
                                .text_size(px(12.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(if is_enabled {
                                    theme.text_primary
                                } else {
                                    theme.text_muted
                                })
                                .child(var_name),
                        )
                        // Type toggle button (Text / Secret)
                        .child(
                            div()
                                .id(ElementId::Name(format!("var-type-{}", v_idx).into()))
                                .px_2()
                                .py_0p5()
                                .rounded_sm()
                                .cursor_pointer()
                                .text_size(px(10.0))
                                .font_weight(FontWeight::BOLD)
                                .when(is_secret, |s| {
                                    s.bg(hsla(45.0, 0.95, 0.50, 0.20))
                                        .text_color(hsla(45.0, 0.95, 0.50, 1.0))
                                })
                                .when(!is_secret, |s| {
                                    s.bg(theme.surface_hover).text_color(theme.text_secondary)
                                })
                                .on_click(move |_, _window, cx| {
                                    view_type_toggle.update(cx, |this, cx| {
                                        if let Some(entry) = this.env_state.selected_entry_mut() {
                                            if let Some(v) =
                                                entry.environment.variables.get_mut(v_idx)
                                            {
                                                v.var_type = if v.var_type == VariableType::Secret {
                                                    VariableType::Default
                                                } else {
                                                    VariableType::Secret
                                                };
                                                entry.is_dirty = true;
                                            }
                                        }
                                        cx.notify();
                                    });
                                })
                                .child(if is_secret { "SECRET" } else { "TEXT" }),
                        )
                        // Variable Value
                        .child(
                            div()
                                .flex_1()
                                .text_size(px(12.0))
                                .font_family("monospace")
                                .text_color(if is_secret {
                                    hsla(45.0, 0.95, 0.50, 1.0)
                                } else if is_enabled {
                                    theme.text_primary
                                } else {
                                    theme.text_muted
                                })
                                .child(display_value),
                        )
                        // Delete row button
                        .child(
                            div()
                                .id(ElementId::Name(format!("var-del-{}", v_idx).into()))
                                .px_1p5()
                                .py_0p5()
                                .rounded_sm()
                                .cursor_pointer()
                                .text_size(px(11.0))
                                .text_color(theme.text_muted)
                                .hover(|s| s.text_color(theme.error))
                                .on_click(move |_, _window, cx| {
                                    view_del_var.update(cx, |this, cx| {
                                        this.env_state.remove_variable(v_idx);
                                        cx.notify();
                                    });
                                })
                                .child("✕"),
                        ),
                );
            }

            div()
                .flex()
                .flex_col()
                .flex_1()
                .h_full()
                // Top Action Bar
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .h(px(44.0))
                        .px_4()
                        .bg(theme.surface)
                        .border_b_1()
                        .border_color(theme.border)
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_3()
                                .child(
                                    div()
                                        .text_size(px(15.0))
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child(env_name),
                                )
                                .child(
                                    div()
                                        .id("set-active-env-btn")
                                        .px_2p5()
                                        .py_1()
                                        .rounded_md()
                                        .cursor_pointer()
                                        .text_size(px(11.0))
                                        .font_weight(FontWeight::BOLD)
                                        .when(is_active, |s| {
                                            s.bg(gpui::hsla(142.0, 0.70, 0.45, 0.20))
                                                .text_color(gpui::hsla(142.0, 0.70, 0.45, 1.0))
                                        })
                                        .when(!is_active, |s| {
                                            s.bg(theme.surface_hover)
                                                .text_color(theme.text_muted)
                                                .hover(|h| h.text_color(theme.text_primary))
                                        })
                                        .on_click(move |_, _window, cx| {
                                            view_set_active.update(cx, |this, cx| {
                                                if is_active {
                                                    this.env_state.active_env_index = None;
                                                } else {
                                                    this.env_state.active_env_index = Some(selected_idx);
                                                }
                                                cx.notify();
                                            });
                                        })
                                        .child(if is_active { "✓ ACTIVE ENVIRONMENT" } else { "Set as Active" }),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2()
                                // Save button
                                .child(
                                    div()
                                        .id("save-env-btn")
                                        .px_3()
                                        .py_1()
                                        .rounded_md()
                                        .cursor_pointer()
                                        .text_size(px(11.0))
                                        .font_weight(FontWeight::BOLD)
                                        .when(is_dirty, |s| {
                                            s.bg(theme.primary).text_color(theme.surface)
                                        })
                                        .when(!is_dirty, |s| {
                                            s.bg(theme.surface_hover).text_color(theme.text_muted)
                                        })
                                        .on_click(move |_, _window, cx| {
                                            view_save.update(cx, |this, cx| {
                                                let key_ref = this.vault_state.cached_key_base64.as_deref();
                                                let ws_salt = this.state.workspace_salt.as_deref();
                                                let _ = this.env_state.save_selected(key_ref, ws_salt);
                                                cx.notify();
                                            });
                                        })
                                        .child(if is_dirty { "● Save" } else { "Saved" }),
                                )
                                // Add Variable button
                                .child(
                                    div()
                                        .id("add-var-btn")
                                        .px_3()
                                        .py_1()
                                        .rounded_md()
                                        .cursor_pointer()
                                        .bg(theme.primary)
                                        .text_color(theme.surface)
                                        .text_size(px(11.0))
                                        .font_weight(FontWeight::BOLD)
                                        .hover(|s| s.opacity(0.9))
                                        .on_click(move |_, _window, cx| {
                                            view_add_var.update(cx, |this, cx| {
                                                let count = this.env_state.selected_entry()
                                                    .map(|e| e.environment.variables.len())
                                                    .unwrap_or(0);
                                                let key = format!("KEY_{}", count + 1);
                                                this.env_state.add_variable(&key, "value", VariableType::Default);
                                                cx.notify();
                                            });
                                        })
                                        .child("+ Add Variable"),
                                ),
                        ),
                )
                // Variables Table
                .child(
                    div()
                        .flex_1()
                        .overflow_y_hidden()
                        .bg(theme.surface)
                        // Table Header
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2()
                                .px_3()
                                .py_2()
                                .bg(theme.surface_hover.opacity(0.4))
                                .border_b_1()
                                .border_color(theme.border)
                                .text_size(px(10.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.text_muted)
                                .child(div().w(px(20.0)))
                                .child(div().w(px(200.0)).child("VARIABLE NAME"))
                                .child(div().w(px(60.0)).child("TYPE"))
                                .child(div().flex_1().child("INITIAL VALUE"))
                                .child(div().w(px(20.0))),
                        )
                        // Table Rows
                        .child(var_rows)
                        .when(entry.environment.variables.is_empty(), |s| {
                            s.child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .items_center()
                                    .justify_center()
                                    .py_10()
                                    .gap_2()
                                    .text_color(theme.text_muted)
                                    .text_size(px(12.0))
                                    .child("No variables configured for this environment.")
                                    .child("Click '+ Add Variable' above to create one."),
                            )
                        }),
                )
                // Tip footer
                .child(
                    div()
                        .flex()
                        .items_center()
                        .h(px(28.0))
                        .px_4()
                        .bg(theme.surface)
                        .border_t_1()
                        .border_color(theme.border)
                        .text_size(px(11.0))
                        .text_color(theme.text_muted)
                        .child("💡 Tip: Reference variables in URLs, headers, or payloads using {{variable_name}} syntax."),
                )
        }
    };

    div()
        .flex()
        .size_full()
        .bg(theme.surface)
        .child(left_sidebar)
        .child(right_content)
}

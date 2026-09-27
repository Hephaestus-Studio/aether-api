//! Settings & Configuration Modal Component.
//!
//! Provides application settings management including Theme selection,
//! Font sizes, Network Timeouts, Proxy settings, and SSL Verification.

use crate::components::text_input::TextInput;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::AppConfig;
use gpui::prelude::*;
use gpui::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsTab {
    General,
    Network,
}

#[derive(Debug, Clone)]
pub struct SettingsModalState {
    pub is_open: bool,
    pub active_tab: SettingsTab,
    pub config: AppConfig,
}

impl SettingsModalState {
    pub fn new() -> Self {
        Self {
            is_open: false,
            active_tab: SettingsTab::General,
            config: AppConfig::load(),
        }
    }

    pub fn open(&mut self) {
        self.config = AppConfig::load();
        self.is_open = true;
    }

    pub fn close(&mut self) {
        self.is_open = false;
    }
}

/// Renders the Settings Modal.
pub fn render_settings_modal(
    state: &SettingsModalState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    proxy_input: Entity<TextInput>,
) -> impl IntoElement {
    if !state.is_open {
        return div().id("settings-modal-closed");
    }

    let active_tab = state.active_tab;
    let cfg = &state.config;

    let view_close = view.clone();
    let view_tab_general = view.clone();
    let view_tab_network = view.clone();
    let view_save = view.clone();

    // Theme switch handlers
    let view_theme_dark = view.clone();
    let view_theme_dracula = view.clone();
    let view_theme_nord = view.clone();
    let view_theme_light = view.clone();

    // Network toggles
    let view_toggle_redirect = view.clone();
    let view_toggle_ssl = view.clone();

    div()
        .id("settings-modal-backdrop")
        .absolute()
        .inset_0()
        .flex()
        .items_center()
        .justify_center()
        .bg(gpui::hsla(0.0, 0.0, 0.0, 0.65))
        .on_mouse_down(MouseButton::Left, move |_, _window, cx| {
            view_close.update(cx, |this, cx| {
                this.settings_modal_state.close();
                cx.notify();
            });
        })
        .child(
            div()
                .id("settings-modal-card")
                .on_mouse_down(MouseButton::Left, |_, _window, cx| {
                    cx.stop_propagation();
                })
                .flex()
                .flex_col()
                .w(px(520.0))
                .h(px(440.0))
                .p_5()
                .gap_4()
                .rounded_lg()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .shadow_lg()
                // Modal Title
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .border_b_1()
                        .border_color(theme.border)
                        .pb_3()
                        .child(
                            div()
                                .text_base()
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.text_primary)
                                .child("⚙ Application Settings"),
                        ),
                )
                // Tabs (General / Network)
                .child(
                    div()
                        .flex()
                        .gap_2()
                        .child(
                            div()
                                .id("settings-tab-general")
                                .px_3()
                                .py_1()
                                .rounded_sm()
                                .cursor_pointer()
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .when(active_tab == SettingsTab::General, |s| {
                                    s.bg(theme.primary).text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                })
                                .when(active_tab != SettingsTab::General, |s| {
                                    s.bg(theme.background).text_color(theme.text_secondary)
                                })
                                .on_click(move |_, _window, cx| {
                                    view_tab_general.update(cx, |this, cx| {
                                        this.settings_modal_state.active_tab = SettingsTab::General;
                                        cx.notify();
                                    });
                                })
                                .child("General & Theme"),
                        )
                        .child(
                            div()
                                .id("settings-tab-network")
                                .px_3()
                                .py_1()
                                .rounded_sm()
                                .cursor_pointer()
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .when(active_tab == SettingsTab::Network, |s| {
                                    s.bg(theme.primary).text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                })
                                .when(active_tab != SettingsTab::Network, |s| {
                                    s.bg(theme.background).text_color(theme.text_secondary)
                                })
                                .on_click(move |_, _window, cx| {
                                    view_tab_network.update(cx, |this, cx| {
                                        this.settings_modal_state.active_tab = SettingsTab::Network;
                                        cx.notify();
                                    });
                                })
                                .child("Network & Security"),
                        ),
                )
                // Content Tab Body
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .flex_1()
                        .overflow_y_hidden()
                        .gap_3()
                        .when(active_tab == SettingsTab::General, |body| {
                            body.child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap_1p5()
                                    .child(div().text_xs().font_weight(FontWeight::BOLD).text_color(theme.text_primary).child("Color Theme"))
                                    .child(
                                        div()
                                            .flex()
                                            .gap_2()
                                            .child(
                                                div()
                                                    .id("theme-btn-dark")
                                                    .px_3()
                                                    .py_1p5()
                                                    .rounded_sm()
                                                    .border_1()
                                                    .cursor_pointer()
                                                    .text_xs()
                                                    .when(cfg.theme == "dark", |s| s.border_color(theme.primary).bg(theme.surface_hover).text_color(theme.primary))
                                                    .when(cfg.theme != "dark", |s| s.border_color(theme.border).bg(theme.background).text_color(theme.text_secondary))
                                                    .on_click(move |_, _window, cx| {
                                                        view_theme_dark.update(cx, |this, cx| {
                                                            this.set_theme_and_save("dark", cx);
                                                        });
                                                    })
                                                    .child("Dark (Default)"),
                                            )
                                            .child(
                                                div()
                                                    .id("theme-btn-dracula")
                                                    .px_3()
                                                    .py_1p5()
                                                    .rounded_sm()
                                                    .border_1()
                                                    .cursor_pointer()
                                                    .text_xs()
                                                    .when(cfg.theme == "dracula", |s| s.border_color(theme.primary).bg(theme.surface_hover).text_color(theme.primary))
                                                    .when(cfg.theme != "dracula", |s| s.border_color(theme.border).bg(theme.background).text_color(theme.text_secondary))
                                                    .on_click(move |_, _window, cx| {
                                                        view_theme_dracula.update(cx, |this, cx| {
                                                            this.set_theme_and_save("dracula", cx);
                                                        });
                                                    })
                                                    .child("Dracula"),
                                            )
                                            .child(
                                                div()
                                                    .id("theme-btn-nord")
                                                    .px_3()
                                                    .py_1p5()
                                                    .rounded_sm()
                                                    .border_1()
                                                    .cursor_pointer()
                                                    .text_xs()
                                                    .when(cfg.theme == "nord", |s| s.border_color(theme.primary).bg(theme.surface_hover).text_color(theme.primary))
                                                    .when(cfg.theme != "nord", |s| s.border_color(theme.border).bg(theme.background).text_color(theme.text_secondary))
                                                    .on_click(move |_, _window, cx| {
                                                        view_theme_nord.update(cx, |this, cx| {
                                                            this.set_theme_and_save("nord", cx);
                                                        });
                                                    })
                                                    .child("Nord"),
                                            )
                                            .child(
                                                div()
                                                    .id("theme-btn-light")
                                                    .px_3()
                                                    .py_1p5()
                                                    .rounded_sm()
                                                    .border_1()
                                                    .cursor_pointer()
                                                    .text_xs()
                                                    .when(cfg.theme == "light", |s| s.border_color(theme.primary).bg(theme.surface_hover).text_color(theme.primary))
                                                    .when(cfg.theme != "light", |s| s.border_color(theme.border).bg(theme.background).text_color(theme.text_secondary))
                                                    .on_click(move |_, _window, cx| {
                                                        view_theme_light.update(cx, |this, cx| {
                                                            this.set_theme_and_save("light", cx);
                                                        });
                                                    })
                                                    .child("Light"),
                                            ),
                                    ),
                            )
                            .child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap_1()
                                    .pt_2()
                                    .child(div().text_xs().font_weight(FontWeight::BOLD).text_color(theme.text_primary).child("Editor Font Size"))
                                    .child(div().text_xs().text_color(theme.text_muted).child(format!("Current: {} px", cfg.font_size))),
                            )
                        })
                        .when(active_tab == SettingsTab::Network, |body| {
                            body.child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap_1p5()
                                    .child(div().text_xs().font_weight(FontWeight::BOLD).text_color(theme.text_primary).child("HTTP Proxy (e.g. http://127.0.0.1:8080)"))
                                    .child(
                                        div()
                                            .h(px(32.0))
                                            .w_full()
                                            .rounded_sm()
                                            .border_1()
                                            .border_color(theme.border)
                                            .bg(theme.background)
                                            .px_2()
                                            .child(proxy_input.clone()),
                                    ),
                            )
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .p_2p5()
                                    .rounded_sm()
                                    .bg(theme.background)
                                    .child(
                                        div()
                                            .flex()
                                            .flex_col()
                                            .child(div().text_xs().font_weight(FontWeight::BOLD).text_color(theme.text_primary).child("Follow Redirects"))
                                            .child(div().text_size(px(11.0)).text_color(theme.text_muted).child("Automatically follow HTTP 3xx status codes")),
                                    )
                                    .child(
                                        div()
                                            .id("toggle-redirects-btn")
                                            .px_3()
                                            .py_1()
                                            .rounded_sm()
                                            .cursor_pointer()
                                            .text_xs()
                                            .font_weight(FontWeight::BOLD)
                                            .when(cfg.follow_redirects, |s| s.bg(theme.primary).text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0)))
                                            .when(!cfg.follow_redirects, |s| s.bg(theme.surface_hover).text_color(theme.text_muted))
                                            .on_click(move |_, _window, cx| {
                                                view_toggle_redirect.update(cx, |this, cx| {
                                                    this.settings_modal_state.config.follow_redirects = !this.settings_modal_state.config.follow_redirects;
                                                    let _ = this.settings_modal_state.config.save();
                                                    cx.notify();
                                                });
                                            })
                                            .child(if cfg.follow_redirects { "ON" } else { "OFF" }),
                                    ),
                            )
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .p_2p5()
                                    .rounded_sm()
                                    .bg(theme.background)
                                    .child(
                                        div()
                                            .flex()
                                            .flex_col()
                                            .child(div().text_xs().font_weight(FontWeight::BOLD).text_color(theme.text_primary).child("Validate SSL Certificates"))
                                            .child(div().text_size(px(11.0)).text_color(theme.text_muted).child("Reject self-signed or invalid HTTPS certificates")),
                                    )
                                    .child(
                                        div()
                                            .id("toggle-ssl-btn")
                                            .px_3()
                                            .py_1()
                                            .rounded_sm()
                                            .cursor_pointer()
                                            .text_xs()
                                            .font_weight(FontWeight::BOLD)
                                            .when(cfg.validate_ssl, |s| s.bg(theme.primary).text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0)))
                                            .when(!cfg.validate_ssl, |s| s.bg(theme.surface_hover).text_color(theme.text_muted))
                                            .on_click(move |_, _window, cx| {
                                                view_toggle_ssl.update(cx, |this, cx| {
                                                    this.settings_modal_state.config.validate_ssl = !this.settings_modal_state.config.validate_ssl;
                                                    let _ = this.settings_modal_state.config.save();
                                                    cx.notify();
                                                });
                                            })
                                            .child(if cfg.validate_ssl { "ON" } else { "OFF" }),
                                    ),
                            )
                        }),
                )
                // Footer
                .child(
                    div()
                        .flex()
                        .justify_end()
                        .pt_2()
                        .child(
                            div()
                                .id("settings-modal-done-btn")
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
                                    view_save.update(cx, |this, cx| {
                                        this.save_settings_and_close(cx);
                                    });
                                })
                                .child("Done"),
                        ),
                ),
        )
}

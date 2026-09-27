use crate::models::request_tab_state::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::request::AuthConfig;
use gpui::prelude::*;
use gpui::*;

/// Renders the Authentication Editor for Bearer Token, Basic Auth, and API Key.
pub fn render_auth_editor(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> Div {
    let auth_type_str = match &tab.request.auth {
        AuthConfig::None => "No Auth",
        AuthConfig::Bearer { .. } => "Bearer Token",
        AuthConfig::Basic { .. } => "Basic Auth",
        AuthConfig::ApiKey { .. } => "API Key",
        AuthConfig::Inherit => "Inherit from Parent",
    };

    let auth_types = ["No Auth", "Bearer Token", "Basic Auth", "API Key"];

    let mut auth_type_selector = div().flex().items_center().gap_1().pb_3();

    for atype in auth_types {
        let is_selected = atype == auth_type_str;
        let atype_str = atype.to_string();
        let view_type = view.clone();

        auth_type_selector = auth_type_selector.child(
            div()
                .id(ElementId::Name(format!("auth-type-{}", atype).into()))
                .px_2p5()
                .py_1()
                .rounded_sm()
                .text_size(px(11.0))
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
                    let atype = atype_str.clone();
                    view_type.update(cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            tab.request.auth = match atype.as_str() {
                                "Bearer Token" => AuthConfig::Bearer {
                                    bearer: aether_core::models::request::BearerAuth {
                                        token: String::new(),
                                        prefix: Some("Bearer".to_string()),
                                    },
                                },
                                "Basic Auth" => AuthConfig::Basic {
                                    basic: aether_core::models::request::BasicAuth {
                                        username: String::new(),
                                        password: String::new(),
                                    },
                                },
                                "API Key" => AuthConfig::ApiKey {
                                    apikey: aether_core::models::request::ApiKeyAuth {
                                        key: String::new(),
                                        value: String::new(),
                                        add_to: "header".to_string(),
                                    },
                                },
                                _ => AuthConfig::None,
                            };
                            tab.is_dirty = true;
                        }
                        cx.notify();
                    });
                })
                .child(atype),
        );
    }

    let auth_fields = match &tab.request.auth {
        AuthConfig::Bearer { bearer } => {
            let token_str = if bearer.token.is_empty() {
                "Enter Bearer token or {{variable}}...".to_string()
            } else {
                bearer.token.clone()
            };
            div()
                .flex()
                .flex_col()
                .gap_2()
                .child(div().text_xs().text_color(theme.text_muted).child("Token"))
                .child(
                    div()
                        .p_2()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .text_xs()
                        .child(token_str),
                )
        }
        AuthConfig::Basic { basic } => {
            let username_str = if basic.username.is_empty() {
                "Username...".to_string()
            } else {
                basic.username.clone()
            };
            let password_str = if basic.password.is_empty() {
                "••••••••".to_string()
            } else {
                basic.password.clone()
            };
            div()
                .flex()
                .flex_col()
                .gap_2()
                .child(
                    div()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .child("Username"),
                )
                .child(
                    div()
                        .p_2()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .text_xs()
                        .child(username_str),
                )
                .child(
                    div()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .child("Password"),
                )
                .child(
                    div()
                        .p_2()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .text_xs()
                        .child(password_str),
                )
        }
        AuthConfig::ApiKey { apikey } => {
            let key_str = if apikey.key.is_empty() {
                "X-API-Key".to_string()
            } else {
                apikey.key.clone()
            };
            let val_str = if apikey.value.is_empty() {
                "API key secret...".to_string()
            } else {
                apikey.value.clone()
            };
            div()
                .flex()
                .flex_col()
                .gap_2()
                .child(
                    div()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .child("Key (Header or Query Name)"),
                )
                .child(
                    div()
                        .p_2()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .text_xs()
                        .child(key_str),
                )
                .child(div().text_xs().text_color(theme.text_muted).child("Value"))
                .child(
                    div()
                        .p_2()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .text_xs()
                        .child(val_str),
                )
        }
        _ => div()
            .text_xs()
            .text_color(theme.text_muted)
            .child("This request does not use any authentication."),
    };

    div()
        .flex()
        .flex_col()
        .flex_1()
        .child(auth_type_selector)
        .child(auth_fields)
}

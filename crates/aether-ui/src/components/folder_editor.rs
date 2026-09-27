//! Folder & Collection Settings Editor Component.
//!
//! Provides folder-level Authentication inheritance, Shared Headers,
//! and Folder Markdown Documentation.

use crate::components::docs_editor::{render_docs_editor, DocsMode};
use crate::components::key_value_editor::render_key_value_table;
use crate::components::text_area::TextArea;
use crate::components::text_input::TextInput;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::key_value::KeyValue;
use aether_core::models::request::{ApiKeyAuth, AuthConfig, BasicAuth, BearerAuth};
use gpui::prelude::*;
use gpui::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FolderSubtab {
    Auth,
    Headers,
    Docs,
}

/// State representing an active folder editor session.
#[derive(Debug, Clone)]
pub struct FolderEditorState {
    pub folder_id: String,
    pub name: String,
    pub relative_path: String,
    pub active_subtab: FolderSubtab,
    pub auth: AuthConfig,
    pub headers: Vec<KeyValue>,
    pub docs: String,
    pub docs_mode: DocsMode,
    pub is_dirty: bool,
}

impl FolderEditorState {
    pub fn new(folder_id: String, name: String, relative_path: String) -> Self {
        Self {
            folder_id,
            name,
            relative_path,
            active_subtab: FolderSubtab::Auth,
            auth: AuthConfig::None,
            headers: Vec::new(),
            docs: String::new(),
            docs_mode: DocsMode::Split,
            is_dirty: false,
        }
    }
}

/// Renders the folder settings editor (Auth, Headers, Docs).
pub fn render_folder_editor(
    folder_state: &FolderEditorState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    docs_editor: Entity<TextArea>,
    auth_input: Entity<TextInput>,
) -> impl IntoElement {
    let view_subtab_auth = view.clone();
    let view_subtab_headers = view.clone();
    let view_subtab_docs = view.clone();
    let view_save = view.clone();

    let folder_name = folder_state.name.clone();
    let folder_path = folder_state.relative_path.clone();
    let active_subtab = folder_state.active_subtab;
    let is_dirty = folder_state.is_dirty;

    div()
        .flex()
        .flex_col()
        .size_full()
        .overflow_hidden()
        // Top Header
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .h(px(42.0))
                .px_4()
                .bg(theme.surface)
                .border_b_1()
                .border_color(theme.border)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        .child(
                            div()
                                .text_lg()
                                .text_color(gpui::hsla(0.12, 0.90, 0.60, 1.0))
                                .child("📁"),
                        )
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .child(
                                    div()
                                        .text_sm()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_primary)
                                        .child(folder_name),
                                )
                                .child(
                                    div()
                                        .text_size(px(10.0))
                                        .text_color(theme.text_muted)
                                        .child(format!("Folder: {}", folder_path)),
                                ),
                        ),
                )
                .child(
                    div()
                        .id("btn-save-folder-settings")
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .px_3()
                        .py_1()
                        .rounded_sm()
                        .bg(if is_dirty { theme.primary } else { theme.surface_hover })
                        .text_color(if is_dirty { hsla(0.0, 0.0, 1.0, 1.0) } else { theme.text_secondary })
                        .text_xs()
                        .font_weight(FontWeight::BOLD)
                        .cursor_pointer()
                        .hover(|s| s.bg(theme.primary_hover).text_color(hsla(0.0, 0.0, 1.0, 1.0)))
                        .on_click(move |_, _window, cx| {
                            view_save.update(cx, |this, cx| {
                                this.save_folder_settings(cx);
                            });
                        })
                        .child(if is_dirty { "● Save Changes" } else { "✓ Saved" }),
                ),
        )
        // Subtabs bar (Auth | Headers | Docs)
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                .h(px(34.0))
                .px_4()
                .bg(theme.surface)
                .border_b_1()
                .border_color(theme.border)
                .child(
                    div()
                        .id("folder-subtab-auth")
                        .px_2p5()
                        .py_1()
                        .rounded_sm()
                        .text_xs()
                        .cursor_pointer()
                        .when(active_subtab == FolderSubtab::Auth, |this| {
                            this.bg(theme.surface_hover)
                                .text_color(theme.primary)
                                .font_weight(FontWeight::BOLD)
                        })
                        .when(active_subtab != FolderSubtab::Auth, |this| {
                            this.text_color(theme.text_secondary)
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        })
                        .on_click(move |_, _window, cx| {
                            view_subtab_auth.update(cx, |this, cx| {
                                this.set_folder_subtab(FolderSubtab::Auth, cx);
                            });
                        })
                        .child("Authentication"),
                )
                .child(
                    div()
                        .id("folder-subtab-headers")
                        .px_2p5()
                        .py_1()
                        .rounded_sm()
                        .text_xs()
                        .cursor_pointer()
                        .when(active_subtab == FolderSubtab::Headers, |this| {
                            this.bg(theme.surface_hover)
                                .text_color(theme.primary)
                                .font_weight(FontWeight::BOLD)
                        })
                        .when(active_subtab != FolderSubtab::Headers, |this| {
                            this.text_color(theme.text_secondary)
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        })
                        .on_click(move |_, _window, cx| {
                            view_subtab_headers.update(cx, |this, cx| {
                                this.set_folder_subtab(FolderSubtab::Headers, cx);
                            });
                        })
                        .child(format!("Shared Headers ({})", folder_state.headers.len())),
                )
                .child(
                    div()
                        .id("folder-subtab-docs")
                        .px_2p5()
                        .py_1()
                        .rounded_sm()
                        .text_xs()
                        .cursor_pointer()
                        .when(active_subtab == FolderSubtab::Docs, |this| {
                            this.bg(theme.surface_hover)
                                .text_color(theme.primary)
                                .font_weight(FontWeight::BOLD)
                        })
                        .when(active_subtab != FolderSubtab::Docs, |this| {
                            this.text_color(theme.text_secondary)
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                        })
                        .on_click(move |_, _window, cx| {
                            view_subtab_docs.update(cx, |this, cx| {
                                this.set_folder_subtab(FolderSubtab::Docs, cx);
                            });
                        })
                        .child("Documentation"),
                ),
        )
        // Subtab Content Area
        .child(
            div()
                .flex_1()
                .overflow_hidden()
                .p_4()
                .when(active_subtab == FolderSubtab::Auth, |this| {
                    this.child(render_folder_auth_editor(
                        &folder_state.auth,
                        theme,
                        view.clone(),
                        auth_input,
                    ))
                })
                .when(active_subtab == FolderSubtab::Headers, |this| {
                    this.child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_2()
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(theme.text_muted)
                                    .child("Headers defined here are automatically inherited by all requests within this folder."),
                            )
                            .child(render_key_value_table(
                                &folder_state.headers,
                                theme,
                                "Inherited Headers",
                                "No inherited headers configured for this folder.",
                                view.clone(),
                                true,
                            )),
                    )
                })
                .when(active_subtab == FolderSubtab::Docs, |this| {
                    this.child(render_docs_editor(
                        &folder_state.docs,
                        folder_state.docs_mode,
                        theme,
                        view.clone(),
                        docs_editor,
                    ))
                }),
        )
}

/// Renders authentication section for folders.
fn render_folder_auth_editor(
    auth: &AuthConfig,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    auth_input: Entity<TextInput>,
) -> Div {
    let auth_type_str = match auth {
        AuthConfig::None => "No Auth",
        AuthConfig::Bearer { .. } => "Bearer Token",
        AuthConfig::Basic { .. } => "Basic Auth",
        AuthConfig::ApiKey { .. } => "API Key",
        AuthConfig::Inherit => "Inherit from Parent",
    };

    let auth_types = [
        "No Auth",
        "Inherit from Parent",
        "Bearer Token",
        "Basic Auth",
        "API Key",
    ];

    let mut auth_type_selector = div().flex().items_center().gap_1().pb_3();

    for atype in auth_types {
        let is_selected = atype == auth_type_str;
        let atype_str = atype.to_string();
        let view_type = view.clone();

        auth_type_selector = auth_type_selector.child(
            div()
                .id(ElementId::Name(
                    format!("folder-auth-type-{}", atype).into(),
                ))
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
                        let new_auth = match atype.as_str() {
                            "Inherit from Parent" => AuthConfig::Inherit,
                            "Bearer Token" => AuthConfig::Bearer {
                                bearer: BearerAuth {
                                    token: String::new(),
                                    prefix: Some("Bearer".to_string()),
                                },
                            },
                            "Basic Auth" => AuthConfig::Basic {
                                basic: BasicAuth {
                                    username: String::new(),
                                    password: String::new(),
                                },
                            },
                            "API Key" => AuthConfig::ApiKey {
                                apikey: ApiKeyAuth {
                                    key: String::new(),
                                    value: String::new(),
                                    add_to: "header".to_string(),
                                },
                            },
                            _ => AuthConfig::None,
                        };
                        this.update_folder_auth(new_auth, cx);
                    });
                })
                .child(atype),
        );
    }

    let auth_fields = match auth {
        AuthConfig::Bearer { .. } => {
            div()
                .flex()
                .flex_col()
                .gap_2()
                .child(div().text_xs().text_color(theme.text_muted).child("Token (Bearer)"))
                .child(
                    div()
                        .h(px(32.0))
                        .child(auth_input),
                )
        }
        AuthConfig::Basic { basic } => {
            div()
                .flex()
                .flex_col()
                .gap_2()
                .child(div().text_xs().text_color(theme.text_muted).child(format!("Basic Auth — User: {}", if basic.username.is_empty() { "(not set)" } else { &basic.username })))
                .child(
                    div()
                        .h(px(32.0))
                        .child(auth_input),
                )
        }
        AuthConfig::ApiKey { apikey } => {
            div()
                .flex()
                .flex_col()
                .gap_2()
                .child(div().text_xs().text_color(theme.text_muted).child(format!("API Key: {}", if apikey.key.is_empty() { "X-API-Key" } else { &apikey.key })))
                .child(
                    div()
                        .h(px(32.0))
                        .child(auth_input),
                )
        }
        AuthConfig::Inherit => {
            div()
                .p_3()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded_sm()
                .text_xs()
                .text_color(theme.text_secondary)
                .child("This folder inherits authentication settings from its parent folder or workspace collection.")
        }
        AuthConfig::None => {
            div()
                .p_3()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded_sm()
                .text_xs()
                .text_color(theme.text_muted)
                .child("No authentication configured for this folder.")
        }
    };

    div()
        .flex()
        .flex_col()
        .flex_1()
        .gap_2()
        .child(auth_type_selector)
        .child(auth_fields)
}

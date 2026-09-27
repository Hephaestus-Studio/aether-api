use crate::components::key_value_editor::render_key_value_table;
use crate::components::text_area::TextArea;
use crate::models::request_tab_state::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::key_value::KeyValue;
use aether_core::models::request::RequestBody;
use gpui::prelude::*;
use gpui::*;

/// Renders the Body Editor with format switcher and payload viewer/editor.
pub fn render_body_editor(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    body_input: Entity<TextArea>,
) -> Div {
    let current_body_type = match &tab.request.body {
        RequestBody::None { .. } => "None",
        RequestBody::Json { .. } => "JSON",
        RequestBody::Text { .. } => "Text",
        RequestBody::Xml { .. } => "XML",
        RequestBody::Yaml { .. } => "YAML",
        RequestBody::FormUrlencoded { .. } => "Form-urlencoded",
        RequestBody::MultipartForm { .. } => "Multipart",
        RequestBody::Binary { .. } => "Binary",
    };

    let body_types = [
        "None",
        "JSON",
        "Text",
        "XML",
        "Form-urlencoded",
        "Multipart",
        "Binary",
    ];

    let mut format_bar = div().flex().items_center().gap_1().h(px(28.0)).pb_2();

    for b_type in body_types {
        let is_selected = b_type == current_body_type;
        let b_type_str = b_type.to_string();
        let view_type = view.clone();

        format_bar = format_bar.child(
            div()
                .id(ElementId::Name(format!("body-type-{}", b_type).into()))
                .px_2()
                .py_0p5()
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
                    let b_type = b_type_str.clone();
                    view_type.update(cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            tab.request.body = match b_type.as_str() {
                                "JSON" => RequestBody::Json {
                                    content: "{\n  \n}".to_string(),
                                },
                                "Text" => RequestBody::Text {
                                    content: String::new(),
                                },
                                "XML" => RequestBody::Xml {
                                    content: "<root></root>".to_string(),
                                },
                                "Form-urlencoded" => RequestBody::FormUrlencoded {
                                    content: Vec::new(),
                                },
                                "Multipart" => RequestBody::MultipartForm {
                                    content: Vec::new(),
                                },
                                "Binary" => RequestBody::Binary {
                                    file_path: String::new(),
                                },
                                _ => RequestBody::None { content: None },
                            };
                            tab.is_dirty = true;
                        }
                        cx.notify();
                    });
                })
                .child(b_type),
        );
    }

    let view_binary = view.clone();

    div()
        .flex()
        .flex_col()
        .flex_1()
        .gap_2()
        .child(format_bar)
        .child(
            div()
                .flex_1()
                .when(current_body_type == "None", |s| {
                    s.p_3()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .child("This request does not have a body.")
                })
                .when(current_body_type == "Form-urlencoded", |s| {
                    let items = match &tab.request.body {
                        RequestBody::FormUrlencoded { content } => content.clone(),
                        _ => Vec::new(),
                    };
                    s.child(render_key_value_table(
                        &items,
                        theme,
                        "Form URL-Encoded Data",
                        "No form parameters configured.",
                        view.clone(),
                        false,
                    ))
                })
                .when(current_body_type == "Multipart", |s| {
                    let items: Vec<KeyValue> = match &tab.request.body {
                        RequestBody::MultipartForm { content } => content
                            .iter()
                            .map(|f| KeyValue {
                                key: f.key.clone(),
                                value: f.value.clone(),
                                enabled: f.enabled,
                                description: None,
                            })
                            .collect(),
                        _ => Vec::new(),
                    };
                    s.child(render_key_value_table(
                        &items,
                        theme,
                        "Multipart Form-Data",
                        "No multipart fields configured.",
                        view.clone(),
                        false,
                    ))
                })
                .when(current_body_type == "Binary", |s| {
                    let file_path = match &tab.request.body {
                        RequestBody::Binary { file_path } => file_path.clone(),
                        _ => String::new(),
                    };
                    let display_path = if file_path.is_empty() {
                        "No file selected".to_string()
                    } else {
                        file_path
                    };

                    s.flex()
                        .flex_col()
                        .gap_3()
                        .p_4()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded_sm()
                        .child(
                            div()
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .text_color(theme.text_secondary)
                                .child("Select Binary File:"),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_3()
                                .child(
                                    div()
                                        .id("btn-pick-binary-file")
                                        .px_3()
                                        .py_1p5()
                                        .rounded_sm()
                                        .bg(theme.primary)
                                        .text_color(hsla(0.0, 0.0, 1.0, 1.0))
                                        .text_xs()
                                        .font_weight(FontWeight::BOLD)
                                        .cursor_pointer()
                                        .hover(|s| s.bg(theme.primary_hover))
                                        .on_click(move |_, _window, cx| {
                                            view_binary.update(cx, |this, cx| {
                                                this.pick_binary_body_file(cx);
                                            });
                                        })
                                        .child("Choose File..."),
                                )
                                .child(
                                    div()
                                        .text_xs()
                                        .font_family("monospace")
                                        .text_color(theme.text_muted)
                                        .child(display_path),
                                ),
                        )
                })
                .when(
                    current_body_type == "JSON"
                        || current_body_type == "Text"
                        || current_body_type == "XML"
                        || current_body_type == "YAML",
                    |s| s.child(body_input),
                ),
        )
}

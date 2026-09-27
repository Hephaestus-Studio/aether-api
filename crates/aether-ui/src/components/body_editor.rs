use crate::models::request_tab_state::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::models::request::RequestBody;
use gpui::prelude::*;
use gpui::*;

/// Renders the Body Editor with format switcher and payload viewer/editor.
pub fn render_body_editor(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
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
    ];

    let body_text_content = match &tab.request.body {
        RequestBody::Json { content } => content.clone(),
        RequestBody::Text { content } => content.clone(),
        RequestBody::Xml { content } => content.clone(),
        RequestBody::Yaml { content } => content.clone(),
        _ => String::new(),
    };

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

    div()
        .flex()
        .flex_col()
        .flex_1()
        .gap_2()
        .child(format_bar)
        .child(
            div()
                .flex_1()
                .p_3()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded_sm()
                .overflow_y_hidden()
                .text_xs()
                .text_color(theme.text_primary)
                .child(if current_body_type == "None" {
                    div()
                        .text_color(theme.text_muted)
                        .child("This request does not have a body.")
                } else if body_text_content.is_empty() {
                    div()
                        .text_color(theme.text_muted)
                        .child("Enter request payload body...")
                } else {
                    div().child(body_text_content)
                }),
        )
}

use crate::components::auth_editor::render_auth_editor;
use crate::components::body_editor::render_body_editor;
use crate::components::key_value_editor::render_key_value_table;
use crate::components::response_viewer::render_response_viewer;
use crate::components::text_area::TextArea;
use crate::components::text_input::TextInput;
use crate::components::url_bar::render_url_bar;
use crate::models::request_tab_state::RequestSubtab;
use crate::models::RequestTabState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the complete Request Editor and Response Viewer layout.
pub fn render_request_editor(
    tab: &RequestTabState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    url_input: Entity<TextInput>,
    body_input: Entity<TextArea>,
) -> impl IntoElement {
    let subtabs = [
        (RequestSubtab::Params, "Params"),
        (RequestSubtab::Auth, "Authorization"),
        (RequestSubtab::Headers, "Headers"),
        (RequestSubtab::Body, "Body"),
    ];

    let mut subtab_bar = div()
        .flex()
        .items_center()
        .gap_4()
        .h(px(34.0))
        .border_b_1()
        .border_color(theme.border);

    for (stype, label) in subtabs {
        let is_active = tab.active_subtab == stype;
        let view_subtab = view.clone();

        subtab_bar = subtab_bar.child(
            div()
                .id(ElementId::Name(format!("req-subtab-{:?}", stype).into()))
                .flex()
                .items_center()
                .h_full()
                .px_1()
                .text_xs()
                .cursor_pointer()
                .when(is_active, |this| {
                    this.border_b_2()
                        .border_color(theme.primary)
                        .text_color(theme.text_primary)
                        .font_weight(FontWeight::BOLD)
                })
                .when(!is_active, |this| {
                    this.text_color(theme.text_secondary)
                        .hover(|s| s.text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    view_subtab.update(cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            tab.active_subtab = stype;
                        }
                        cx.notify();
                    });
                })
                .child(label),
        );
    }

    let subtab_content = match tab.active_subtab {
        RequestSubtab::Params => render_key_value_table(
            &tab.request.params,
            theme,
            "params",
            "No Query Parameters added yet.",
            view.clone(),
            false,
        ),
        RequestSubtab::Headers => render_key_value_table(
            &tab.request.headers,
            theme,
            "headers",
            "No Custom Headers added yet.",
            view.clone(),
            true,
        ),
        RequestSubtab::Auth => render_auth_editor(tab, theme, view.clone()),
        RequestSubtab::Body => render_body_editor(tab, theme, view.clone(), body_input),
        RequestSubtab::Settings => render_key_value_table(
            &[],
            theme,
            "settings",
            "Request Settings configured via workspace config.",
            view.clone(),
            false,
        ),
    };

    div()
        .flex()
        .flex_col()
        .flex_1()
        .gap_3()
        // Top URL Bar
        .child(render_url_bar(tab, theme, view.clone(), url_input))
        // Split Container: Top Request Area + Bottom Response Area
        .child(
            div()
                .flex()
                .flex_col()
                .flex_1()
                .gap_4()
                // Top Request Section
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .h(px(220.0))
                        .child(subtab_bar)
                        .child(
                            div()
                                .flex_1()
                                .pt_2()
                                .overflow_y_hidden()
                                .child(subtab_content),
                        ),
                )
                // Bottom Response Section
                .child(render_response_viewer(tab, theme, view)),
        )
}

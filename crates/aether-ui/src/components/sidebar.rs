use crate::components::git_panel::render_git_panel;
use crate::components::text_input::TextInput;
use crate::components::tree_view::render_tree_node;
use crate::models::git_state::GitState;
use crate::models::workspace_state::{SidebarTab, WorkspaceState};
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the left Sidebar panel containing Workspace Tree Explorer, Git, or Environments.
pub fn render_sidebar(
    state: &WorkspaceState,
    git_state: &GitState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    commit_input: Entity<TextInput>,
) -> impl IntoElement {
    let workspace_name = state
        .tree
        .as_ref()
        .map(|t| t.name.to_uppercase())
        .unwrap_or_else(|| "NO WORKSPACE".to_string());

    let header_title = match state.sidebar_tab {
        SidebarTab::Explorer => "EXPLORER",
        SidebarTab::Git => "SOURCE CONTROL",
        SidebarTab::Environments => "ENVIRONMENTS",
    };

    let view_refresh = view.clone();

    div()
        .flex()
        .flex_col()
        .w(px(state.sidebar_width))
        .h_full()
        .bg(theme.surface)
        .border_r_1()
        .border_color(theme.border)
        // Top Header
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .h(px(34.0))
                .px_3()
                .border_b_1()
                .border_color(theme.border)
                .child(
                    div()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.text_muted)
                        .child(header_title),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1()
                        // Toggle/Reload icon button
                        .child(
                            div()
                                .id("sidebar-collapse-btn")
                                .flex()
                                .items_center()
                                .justify_center()
                                .size(px(20.0))
                                .rounded_sm()
                                .text_size(px(11.0))
                                .cursor_pointer()
                                .text_color(theme.text_muted)
                                .hover(|style| {
                                    style.bg(theme.surface_hover).text_color(theme.text_primary)
                                })
                                .on_click(move |_, _window, cx| {
                                    view_refresh.update(cx, |this, cx| {
                                        this.reload(cx);
                                    });
                                })
                                .child("◫"),
                        ),
                ),
        )
        // Sidebar Content based on Active Tab
        .child(match state.sidebar_tab {
            SidebarTab::Git => div().flex_1().child(render_git_panel(
                git_state,
                theme,
                view.clone(),
                commit_input,
            )),
            _ => div()
                .flex_1()
                .flex_col()
                // Workspace Tree Root header
                .when(state.tree.is_some(), |this| {
                    this.child(
                        div()
                            .flex()
                            .items_center()
                            .gap_1p5()
                            .h(px(28.0))
                            .px_3()
                            .text_size(px(11.0))
                            .font_weight(FontWeight::BOLD)
                            .text_color(theme.text_primary)
                            .child(
                                div()
                                    .text_size(px(10.0))
                                    .text_color(theme.text_muted)
                                    .child("⌄"),
                            )
                            .child(workspace_name),
                    )
                })
                // Tree View Items
                .child(
                    div()
                        .flex_1()
                        .overflow_y_hidden()
                        .py_1()
                        .when_some(state.tree.as_ref(), |this, tree| {
                            let mut col = this;
                            for child in &tree.children {
                                col = col.child(render_tree_node(
                                    child,
                                    state,
                                    theme,
                                    0,
                                    view.clone(),
                                ));
                            }
                            col
                        })
                        .when(state.tree.is_none(), |this| {
                            let view_open = view.clone();
                            this.flex()
                                .flex_col()
                                .items_center()
                                .justify_center()
                                .p_4()
                                .gap_3()
                                .child(
                                    div()
                                        .text_xs()
                                        .text_color(theme.text_muted)
                                        .child("No workspace open."),
                                )
                                .child(
                                    div()
                                        .id("sidebar-open-folder-btn")
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
                                            view_open.update(cx, |this, cx| {
                                                this.open_folder_dialog(cx);
                                            });
                                        })
                                        .child("Open Folder..."),
                                )
                        }),
                ),
        })
}

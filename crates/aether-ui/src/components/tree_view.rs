use crate::components::method_badge::render_method_badge;
use crate::models::WorkspaceState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use aether_core::engine::fs_scanner::{NodeType, WorkspaceTreeNode};
use gpui::prelude::*;
use gpui::*;

/// Renders a tree view node recursively with level-based indentation matching original Explorer.
pub fn render_tree_node(
    node: &WorkspaceTreeNode,
    state: &WorkspaceState,
    theme: &Theme,
    level: usize,
    view: Entity<WorkspaceView>,
) -> Div {
    let node_id_for_click = node.id.clone();
    let node_for_select = node.clone();
    let is_expanded = state.is_expanded(&node.id);
    let is_selected = state.selected_node_id.as_deref() == Some(&node.id);

    let indent_px = (level as f32) * 16.0 + 8.0;

    let is_expandable = node.node_type == NodeType::Collection
        || node.node_type == NodeType::Folder
        || !node.children.is_empty();

    let chevron = if is_expandable {
        if is_expanded {
            "⌄"
        } else {
            "›"
        }
    } else {
        " "
    };

    let folder_icon = match node.node_type {
        NodeType::Collection | NodeType::Folder => "📁 ",
        _ => "",
    };

    let view_click = view.clone();

    let item_row = div()
        .id(ElementId::Name(format!("node-{}", node.id).into()))
        .flex()
        .items_center()
        .gap_2()
        .h(px(28.0))
        .mx_1()
        .pl(px(indent_px))
        .pr_2()
        .rounded_md()
        .cursor_pointer()
        .when(is_selected, |this| {
            this.bg(gpui::hsla(220.0 / 360.0, 0.16, 0.22, 1.0))
                .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                .font_weight(FontWeight::MEDIUM)
        })
        .when(!is_selected, |this| {
            this.hover(|style| {
                style.bg(gpui::hsla(220.0 / 360.0, 0.14, 0.16, 0.8))
            })
            .text_color(theme.text_secondary)
        })
        .on_click(move |_, _window, cx| {
            let node_id = node_id_for_click.clone();
            let node = node_for_select.clone();
            view_click.update(cx, |this, cx| {
                if is_expandable {
                    this.toggle_node(&node_id, cx);
                } else {
                    this.open_request(&node, cx);
                }
            });
        })
        // Chevron
        .when(is_expandable, |this| {
            this.child(
                div()
                    .w(px(12.0))
                    .text_size(px(11.0))
                    .font_weight(FontWeight::BOLD)
                    .text_color(theme.text_muted)
                    .child(chevron),
            )
        })
        // Method badge for requests
        .when(node.node_type == NodeType::Request, |this| {
            let method = node.method.as_deref().unwrap_or("GET");
            this.child(render_method_badge(method, theme))
        })
        // Folder / Collection prefix icon
        .when(!folder_icon.is_empty(), |this| {
            this.child(
                div()
                    .text_size(px(12.0))
                    .text_color(theme.primary)
                    .child(folder_icon),
            )
        })
        // Node name
        .child(
            div()
                .flex_1()
                .text_xs()
                .overflow_hidden()
                .child(node.name.clone()),
        );

    let mut container = div().flex().flex_col().child(item_row);

    // If expanded, render children recursively
    if is_expandable && is_expanded {
        for child in &node.children {
            container = container.child(render_tree_node(
                child,
                state,
                theme,
                level + 1,
                view.clone(),
            ));
        }
    }

    container
}

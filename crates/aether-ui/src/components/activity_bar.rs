//! Activity Bar component for the far-left vertical icon rail.
//!
//! Provides quick switching between Explorer (Collections), Git Source Control,
//! Environment Variables, and Settings, with active indicator, badge counters,
//! and sidebar collapse toggling.

use crate::models::workspace_state::SidebarTab;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the 48px-wide vertical Activity Bar rail on the far left.
pub fn render_activity_bar(
    active_tab: SidebarTab,
    is_sidebar_collapsed: bool,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    git_changes_count: usize,
) -> impl IntoElement {
    let top_items = [
        (SidebarTab::Explorer, "📁", "Collections & Requests", 0),
        (
            SidebarTab::Git,
            "🔀",
            "Source Control (Git)",
            git_changes_count,
        ),
        (SidebarTab::Environments, "🌐", "Environments & Secrets", 0),
    ];

    let mut top_section = div()
        .flex()
        .flex_col()
        .items_center()
        .w_full()
        .pt_2()
        .gap_1();

    for (tab_type, icon, _label, badge) in top_items {
        let is_active = !is_sidebar_collapsed && active_tab == tab_type;
        let view_toggle = view.clone();

        top_section = top_section.child(
            div()
                .id(ElementId::Name(
                    format!("activity-item-{:?}", tab_type).into(),
                ))
                .relative()
                .flex()
                .items_center()
                .justify_center()
                .w(px(40.0))
                .h(px(40.0))
                .rounded_md()
                .cursor_pointer()
                .when(is_active, |this| {
                    this.bg(theme.surface_hover).text_color(theme.primary)
                })
                .when(!is_active, |this| {
                    this.text_color(theme.text_muted)
                        .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                })
                .on_click(move |_, _window, cx| {
                    view_toggle.update(cx, |this, cx| {
                        this.state.toggle_sidebar_tab(tab_type);
                        cx.notify();
                    });
                })
                // Active indicator line on the left
                .when(is_active, |this| {
                    this.child(
                        div()
                            .absolute()
                            .left(px(0.0))
                            .top(px(8.0))
                            .bottom(px(8.0))
                            .w(px(2.5))
                            .bg(theme.primary)
                            .rounded_r_sm(),
                    )
                })
                .child(div().text_lg().child(icon))
                // Optional badge count (e.g. Git modified files)
                .when(badge > 0, |this| {
                    this.child(
                        div()
                            .absolute()
                            .top(px(4.0))
                            .right(px(4.0))
                            .px_1()
                            .h(px(14.0))
                            .min_w(px(14.0))
                            .rounded_full()
                            .bg(theme.primary)
                            .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                            .text_size(px(9.0))
                            .font_weight(FontWeight::BOLD)
                            .flex()
                            .items_center()
                            .justify_center()
                            .child(badge.to_string()),
                    )
                }),
        );
    }

    // Bottom Settings / Command Palette Trigger
    let view_settings = view.clone();
    let bottom_section = div()
        .flex()
        .flex_col()
        .items_center()
        .w_full()
        .pb_2()
        .gap_1()
        .child(
            div()
                .id("activity-item-settings")
                .flex()
                .items_center()
                .justify_center()
                .w(px(40.0))
                .h(px(40.0))
                .rounded_md()
                .cursor_pointer()
                .text_color(theme.text_muted)
                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                .on_click(move |_, _window, cx| {
                    view_settings.update(cx, |this, cx| {
                        this.open_command_palette(cx);
                    });
                })
                .child(div().text_lg().child("⚙️")),
        );

    // Full Activity Bar container (48px wide)
    div()
        .flex()
        .flex_col()
        .justify_between()
        .items_center()
        .w(px(48.0))
        .h_full()
        .bg(theme.background)
        .border_r_1()
        .border_color(theme.border)
        .child(top_section)
        .child(bottom_section)
}

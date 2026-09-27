use aether_core::models::recent_workspace::{RecentWorkspace, RecentWorkspacesList};
use crate::theme::Theme;
use gpui::prelude::*;
use gpui::*;
use std::path::{Path, PathBuf};

/// Tab options in the Launcher sidebar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LauncherTab {
    Projects,
    Customize,
}

/// Events emitted by the LauncherView.
#[derive(Debug, Clone)]
pub enum LauncherEvent {
    OpenWorkspace(PathBuf),
    CreateNewProject,
    CloneRepository,
}

/// The Welcome & Project Launcher View.
pub struct LauncherView {
    pub recent_workspaces: RecentWorkspacesList,
    pub search_query: String,
    pub active_tab: LauncherTab,
    pub theme: Theme,
    pub clone_dialog_open: bool,
    pub clone_url_input: String,
}

impl EventEmitter<LauncherEvent> for LauncherView {}

impl LauncherView {
    pub fn new() -> Self {
        let recent_workspaces = RecentWorkspacesList::load();
        Self {
            recent_workspaces,
            search_query: String::new(),
            active_tab: LauncherTab::Projects,
            theme: Theme::dark(),
            clone_dialog_open: false,
            clone_url_input: String::new(),
        }
    }

    pub fn reload_recents(&mut self) {
        self.recent_workspaces = RecentWorkspacesList::load();
    }

    pub fn select_tab(&mut self, tab: LauncherTab, cx: &mut Context<Self>) {
        self.active_tab = tab;
        cx.notify();
    }

    pub fn set_search_query(&mut self, query: String, cx: &mut Context<Self>) {
        self.search_query = query;
        cx.notify();
    }

    pub fn open_folder_dialog(&mut self, cx: &mut Context<Self>) {
        cx.spawn(|view: WeakEntity<LauncherView>, cx: &mut AsyncApp| {
            let cx = cx.clone();
            async move {
                let mut cx = cx;
                if let Some(folder) = rfd::AsyncFileDialog::new().pick_folder().await {
                    let path = folder.path().to_path_buf();
                    let _ = view.update(&mut cx, |this, cx| {
                        this.recent_workspaces.add_or_update(&path, None);
                        cx.emit(LauncherEvent::OpenWorkspace(path));
                        cx.notify();
                    });
                }
            }
        })
        .detach();
    }

    pub fn open_workspace(&mut self, path: PathBuf, cx: &mut Context<Self>) {
        self.recent_workspaces.add_or_update(&path, None);
        cx.emit(LauncherEvent::OpenWorkspace(path));
        cx.notify();
    }

    pub fn remove_recent(&mut self, path: &Path, cx: &mut Context<Self>) {
        self.recent_workspaces.remove(path);
        cx.notify();
    }

    pub fn filtered_workspaces(&self) -> Vec<RecentWorkspace> {
        if self.search_query.is_empty() {
            self.recent_workspaces.workspaces.clone()
        } else {
            let query = self.search_query.to_lowercase();
            self.recent_workspaces
                .workspaces
                .iter()
                .filter(|w| {
                    w.name.to_lowercase().contains(&query)
                        || w.path.to_string_lossy().to_lowercase().contains(&query)
                })
                .cloned()
                .collect()
        }
    }
}

impl Render for LauncherView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let theme = &self.theme;
        let active_tab = self.active_tab;
        let filtered = self.filtered_workspaces();

        div()
            .flex()
            .size_full()
            .bg(theme.background)
            .text_color(theme.text_primary)
            // Left Sidebar
            .child(
                div()
                    .flex()
                    .flex_col()
                    .w(px(240.0))
                    .h_full()
                    .bg(theme.surface)
                    .border_r_1()
                    .border_color(theme.border)
                    .p_4()
                    .gap_6()
                    // Logo Header
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_3()
                            // Logo Badge Icon
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .size(px(38.0))
                                    .rounded_md()
                                    .bg(gpui::hsla(217.0, 0.91, 0.60, 0.2))
                                    .border_1()
                                    .border_color(theme.primary)
                                    .text_size(px(18.0))
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(theme.primary)
                                    .child("A"),
                            )
                            // Brand Titles
                            .child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .child(
                                        div()
                                            .text_sm()
                                            .font_weight(FontWeight::BOLD)
                                            .text_color(theme.text_primary)
                                            .child("AetherAPI"),
                                    )
                                    .child(
                                        div()
                                            .text_size(px(11.0))
                                            .text_color(theme.text_muted)
                                            .child("v0.3.0-beta.3"),
                                    ),
                            ),
                    )
                    // Navigation List
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1p5()
                            // Projects Button
                            .child(
                                div()
                                    .id("launcher-tab-projects")
                                    .flex()
                                    .items_center()
                                    .px_3()
                                    .py_2()
                                    .rounded_md()
                                    .cursor_pointer()
                                    .text_sm()
                                    .when(active_tab == LauncherTab::Projects, |this| {
                                        this.bg(theme.primary)
                                            .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                            .font_weight(FontWeight::BOLD)
                                    })
                                    .when(active_tab != LauncherTab::Projects, |this| {
                                        this.text_color(theme.text_secondary).hover(|s| {
                                            s.bg(theme.surface_hover).text_color(theme.text_primary)
                                        })
                                    })
                                    .on_click(cx.listener(|this, _event, _window, cx| {
                                        this.select_tab(LauncherTab::Projects, cx);
                                    }))
                                    .child("Projects"),
                            )
                            // Customize Button
                            .child(
                                div()
                                    .id("launcher-tab-customize")
                                    .flex()
                                    .items_center()
                                    .px_3()
                                    .py_2()
                                    .rounded_md()
                                    .cursor_pointer()
                                    .text_sm()
                                    .when(active_tab == LauncherTab::Customize, |this| {
                                        this.bg(theme.primary)
                                            .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                            .font_weight(FontWeight::BOLD)
                                    })
                                    .when(active_tab != LauncherTab::Customize, |this| {
                                        this.text_color(theme.text_secondary).hover(|s| {
                                            s.bg(theme.surface_hover).text_color(theme.text_primary)
                                        })
                                    })
                                    .on_click(cx.listener(|this, _event, _window, cx| {
                                        this.select_tab(LauncherTab::Customize, cx);
                                    }))
                                    .child("Customize"),
                            ),
                    ),
            )
            // Right Main Content Area
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_1()
                    .h_full()
                    .p_6()
                    .justify_between()
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_4()
                            // Top Search and Quick Actions Bar
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .gap_3()
                                    // Search Bar Container
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_2()
                                            .w(px(320.0))
                                            .h(px(36.0))
                                            .px_3()
                                            .bg(theme.surface)
                                            .border_1()
                                            .border_color(theme.border)
                                            .rounded_md()
                                            .child(
                                                div()
                                                    .text_size(px(12.0))
                                                    .text_color(theme.text_muted)
                                                    .child("Q"),
                                            )
                                            .child(
                                                div()
                                                    .text_xs()
                                                    .text_color(if self.search_query.is_empty() {
                                                        theme.text_muted
                                                    } else {
                                                        theme.text_primary
                                                    })
                                                    .child(if self.search_query.is_empty() {
                                                        "Search recent workspaces...".to_string()
                                                    } else {
                                                        self.search_query.clone()
                                                    }),
                                            ),
                                    )
                                    // Action Buttons (+ / Open / Clone)
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_2()
                                            // New / Open Workspace (+)
                                            .child(
                                                div()
                                                    .id("launcher-new-btn")
                                                    .flex()
                                                    .items_center()
                                                    .justify_center()
                                                    .size(px(36.0))
                                                    .rounded_md()
                                                    .bg(theme.primary)
                                                    .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                                    .text_sm()
                                                    .font_weight(FontWeight::BOLD)
                                                    .cursor_pointer()
                                                    .hover(|s| s.bg(theme.primary_hover))
                                                    .on_click(cx.listener(|this, _event, _window, cx| {
                                                        this.open_folder_dialog(cx);
                                                    }))
                                                    .child("+"),
                                            )
                                            // Open Folder button
                                            .child(
                                                div()
                                                    .id("launcher-open-folder-btn")
                                                    .flex()
                                                    .items_center()
                                                    .justify_center()
                                                    .size(px(36.0))
                                                    .rounded_md()
                                                    .bg(theme.surface)
                                                    .border_1()
                                                    .border_color(theme.border)
                                                    .text_color(theme.text_secondary)
                                                    .text_xs()
                                                    .cursor_pointer()
                                                    .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                                    .on_click(cx.listener(|this, _event, _window, cx| {
                                                        this.open_folder_dialog(cx);
                                                    }))
                                                    .child("Folder"),
                                            )
                                            // Clone from Git button
                                            .child(
                                                div()
                                                    .id("launcher-clone-git-btn")
                                                    .flex()
                                                    .items_center()
                                                    .justify_center()
                                                    .size(px(36.0))
                                                    .rounded_md()
                                                    .bg(theme.surface)
                                                    .border_1()
                                                    .border_color(theme.border)
                                                    .text_color(theme.text_secondary)
                                                    .text_xs()
                                                    .cursor_pointer()
                                                    .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                                    .on_click(cx.listener(|this, _event, _window, cx| {
                                                        this.open_folder_dialog(cx);
                                                    }))
                                                    .child("Git"),
                                            ),
                                    ),
                            )
                            // Content Section based on Active Tab
                            .child(match active_tab {
                                LauncherTab::Projects => {
                                    if filtered.is_empty() {
                                        div()
                                            .flex()
                                            .flex_col()
                                            .items_center()
                                            .justify_center()
                                            .py_12()
                                            .gap_3()
                                            .child(
                                                div()
                                                    .text_xs()
                                                    .text_color(theme.text_muted)
                                                    .child("No recent workspaces found."),
                                            )
                                            .child(
                                                div()
                                                    .id("launcher-empty-open-btn")
                                                    .px_4()
                                                    .py_2()
                                                    .rounded_md()
                                                    .bg(theme.primary)
                                                    .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                                    .text_xs()
                                                    .font_weight(FontWeight::BOLD)
                                                    .cursor_pointer()
                                                    .hover(|s| s.bg(theme.primary_hover))
                                                    .on_click(cx.listener(|this, _event, _window, cx| {
                                                        this.open_folder_dialog(cx);
                                                    }))
                                                    .child("Open Workspace Folder"),
                                            )
                                    } else {
                                        let mut list_col = div()
                                            .flex()
                                            .flex_col()
                                            .gap_2()
                                            .overflow_y_hidden();

                                        for ws in filtered {
                                            let path_clone = ws.path.clone();
                                            let path_str = ws.path.to_string_lossy().to_string();
                                            let ws_name = ws.name.clone();

                                            list_col = list_col.child(
                                                div()
                                                    .id(ElementId::Name(format!("ws-item-{}", path_str).into()))
                                                    .flex()
                                                    .items_center()
                                                    .justify_between()
                                                    .p_3()
                                                    .rounded_md()
                                                    .bg(theme.surface)
                                                    .border_1()
                                                    .border_color(theme.border)
                                                    .cursor_pointer()
                                                    .hover(|s| s.bg(theme.surface_hover).border_color(theme.primary))
                                                    .on_click(cx.listener(move |this, _event, _window, cx| {
                                                        this.open_workspace(path_clone.clone(), cx);
                                                    }))
                                                    .child(
                                                        div()
                                                            .flex()
                                                            .flex_col()
                                                            .gap_1()
                                                            .child(
                                                                div()
                                                                    .text_sm()
                                                                    .font_weight(FontWeight::BOLD)
                                                                    .text_color(theme.text_primary)
                                                                    .child(ws_name),
                                                            )
                                                            .child(
                                                                div()
                                                                    .text_xs()
                                                                    .text_color(theme.text_muted)
                                                                    .child(path_str),
                                                            ),
                                                    ),
                                            );
                                        }

                                        list_col
                                    }
                                }
                                LauncherTab::Customize => {
                                    div()
                                        .flex()
                                        .flex_col()
                                        .gap_4()
                                        .p_4()
                                        .rounded_md()
                                        .bg(theme.surface)
                                        .border_1()
                                        .border_color(theme.border)
                                        .child(
                                            div()
                                                .text_sm()
                                                .font_weight(FontWeight::BOLD)
                                                .text_color(theme.text_primary)
                                                .child("Appearance & Customization"),
                                        )
                                        .child(
                                            div()
                                                .flex()
                                                .items_center()
                                                .justify_between()
                                                .child(
                                                    div()
                                                        .text_xs()
                                                        .text_color(theme.text_secondary)
                                                        .child("Theme Mode"),
                                                )
                                                .child(
                                                    div()
                                                        .px_3()
                                                        .py_1()
                                                        .rounded_sm()
                                                        .bg(theme.surface_hover)
                                                        .text_xs()
                                                        .text_color(theme.primary)
                                                        .child("Dark (Default)"),
                                                ),
                                        )
                                        .child(
                                            div()
                                                .flex()
                                                .items_center()
                                                .justify_between()
                                                .child(
                                                    div()
                                                        .text_xs()
                                                        .text_color(theme.text_secondary)
                                                        .child("Storage Engine"),
                                                )
                                                .child(
                                                    div()
                                                        .text_xs()
                                                        .text_color(theme.text_muted)
                                                        .child("Local-First YAML / Git"),
                                                ),
                                        )
                                }
                            }),
                    )
                    // Footer
                    .child(
                        div()
                            .flex()
                            .justify_end()
                            .text_size(px(11.0))
                            .text_color(theme.text_muted)
                            .child("Hephaestus Studio © 2026"),
                    ),
            )
    }
}

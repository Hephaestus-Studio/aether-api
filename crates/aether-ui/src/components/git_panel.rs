//! Git Source Control sidebar panel component.
//!
//! Provides commit composer, staged/unstaged change tracking,
//! one-click stage/unstage/discard, conflict detection, and branch switching.

use crate::components::text_input::TextInput;
use crate::models::git_state::GitState;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

/// Renders the Source Control panel inside the left sidebar.
pub fn render_git_panel(
    git_state: &GitState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    commit_input: Entity<TextInput>,
) -> impl IntoElement {
    if !git_state.is_git_repo {
        let view_init = view.clone();
        return div()
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .p_4()
            .gap_3()
            .child(div().text_2xl().text_color(theme.text_muted).child("🔀"))
            .child(
                div()
                    .text_xs()
                    .text_color(theme.text_muted)
                    .child("No Git repository found in workspace."),
            )
            .child(
                div()
                    .id("btn-git-init")
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
                        view_init.update(cx, |this, cx| {
                            this.git_init_repository(cx);
                        });
                    })
                    .child("Initialize Git Repository"),
            );
    }

    let status = match &git_state.status {
        Some(s) => s.clone(),
        None => {
            let view_refresh = view.clone();
            return div()
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .p_4()
                .gap_2()
                .child(
                    div()
                        .text_xs()
                        .text_color(theme.text_muted)
                        .child("Loading Git status..."),
                )
                .child(
                    div()
                        .id("btn-git-load-status")
                        .px_2()
                        .py_1()
                        .rounded_sm()
                        .bg(theme.surface_hover)
                        .text_xs()
                        .cursor_pointer()
                        .on_click(move |_, _window, cx| {
                            view_refresh.update(cx, |this, cx| {
                                this.refresh_git_status(cx);
                            });
                        })
                        .child("Refresh"),
                );
        }
    };

    let view_refresh = view.clone();
    let view_sync = view.clone();
    let view_commit = view.clone();
    let view_stage_all = view.clone();
    let view_unstage_all = view.clone();
    let view_discard_all = view.clone();
    let view_branch_toggle = view.clone();

    let branch_name = status.branch_name.clone();
    let ahead_count = status.ahead_count;
    let behind_count = status.behind_count;
    let is_syncing = git_state.sync_in_progress;
    let is_committing = git_state.commit_in_progress;

    div()
        .flex()
        .flex_col()
        .size_full()
        .overflow_hidden()
        // Git Header Action Bar
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .h(px(32.0))
                .px_3()
                .bg(theme.surface)
                .border_b_1()
                .border_color(theme.border)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .text_size(px(11.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(theme.text_muted)
                        .child("CHANGES"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1()
                        // Sync / Fetch / Push
                        .child(
                            div()
                                .id("btn-git-sync")
                                .flex()
                                .items_center()
                                .gap_1()
                                .px_1p5()
                                .h(px(20.0))
                                .rounded_sm()
                                .text_size(px(10.0))
                                .text_color(theme.text_primary)
                                .bg(theme.surface_hover)
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.border))
                                .on_click(move |_, _window, cx| {
                                    view_sync.update(cx, |this, cx| {
                                        this.git_smart_sync(cx);
                                    });
                                })
                                .child(if is_syncing {
                                    "⏳ Syncing"
                                } else {
                                    "↑↓ Sync"
                                }),
                        )
                        // Refresh button
                        .child(
                            div()
                                .id("btn-git-refresh")
                                .flex()
                                .items_center()
                                .justify_center()
                                .size(px(20.0))
                                .rounded_sm()
                                .text_size(px(11.0))
                                .text_color(theme.text_muted)
                                .cursor_pointer()
                                .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                                .on_click(move |_, _window, cx| {
                                    view_refresh.update(cx, |this, cx| {
                                        this.refresh_git_status(cx);
                                    });
                                })
                                .child("↻"),
                        ),
                ),
        )
        // Error banner if any
        .when_some(git_state.error_message.clone(), |this, err| {
            let view_dismiss = view.clone();
            this.child(
                div()
                    .flex()
                    .items_start()
                    .justify_between()
                    .p_2()
                    .bg(gpui::hsla(0.0, 0.65, 0.2, 0.4))
                    .border_b_1()
                    .border_color(gpui::hsla(0.0, 0.65, 0.4, 0.6))
                    .text_xs()
                    .text_color(gpui::hsla(0.0, 0.85, 0.75, 1.0))
                    .child(div().flex_1().child(err))
                    .child(
                        div()
                            .id("btn-dismiss-git-error")
                            .cursor_pointer()
                            .text_color(theme.text_muted)
                            .hover(|s| s.text_color(theme.text_primary))
                            .on_click(move |_, _window, cx| {
                                view_dismiss.update(cx, |this, cx| {
                                    this.git_state.clear_error();
                                    cx.notify();
                                });
                            })
                            .child("✕"),
                    ),
            )
        })
        // Commit Composer Section
        .child(
            div()
                .flex()
                .flex_col()
                .p_2()
                .gap_2()
                .bg(theme.surface)
                .border_b_1()
                .border_color(theme.border)
                .child(div().h(px(32.0)).child(commit_input.clone()))
                .child(
                    div()
                        .id("btn-git-commit")
                        .flex()
                        .items_center()
                        .justify_center()
                        .h(px(26.0))
                        .rounded_sm()
                        .bg(theme.primary)
                        .text_color(hsla(0.0, 0.0, 1.0, 1.0))
                        .text_xs()
                        .font_weight(FontWeight::BOLD)
                        .cursor_pointer()
                        .hover(|s| s.bg(theme.primary_hover))
                        .on_click(move |_, _window, cx| {
                            view_commit.update(cx, |this, cx| {
                                this.git_commit(cx);
                            });
                        })
                        .child(if is_committing {
                            "Committing..."
                        } else {
                            "✓ Commit"
                        }),
                ),
        )
        // Scrollable Changes List Area
        .child(
            div()
                .flex_1()
                .overflow_y_hidden()
                .py_1()
                // Conflicted Files Section
                .when(!status.conflicted_files.is_empty(), |this| {
                    let mut col = this.child(
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .px_3()
                            .py_1()
                            .bg(gpui::hsla(0.12, 0.50, 0.20, 0.4))
                            .border_b_1()
                            .border_color(gpui::hsla(0.12, 0.50, 0.40, 0.6))
                            .child(
                                div()
                                    .text_size(px(10.0))
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(gpui::hsla(0.12, 0.90, 0.65, 1.0))
                                    .child(format!(
                                        "MERGE CONFLICTS ({})",
                                        status.conflicted_files.len()
                                    )),
                            ),
                    );

                    for file in &status.conflicted_files {
                        let path = file.path.clone();
                        let view_conflict = view.clone();
                        col = col.child(
                            div()
                                .id(ElementId::Name(format!("conflict-item-{}", path).into()))
                                .flex()
                                .items_center()
                                .justify_between()
                                .px_3()
                                .py_1()
                                .text_size(px(11.0))
                                .hover(|s| s.bg(theme.surface_hover))
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_1p5()
                                        .child(
                                            div()
                                                .text_color(gpui::hsla(0.12, 0.90, 0.65, 1.0))
                                                .child("⚡"),
                                        )
                                        .child(
                                            div()
                                                .text_color(theme.text_primary)
                                                .child(path.clone()),
                                        ),
                                )
                                .child(
                                    div()
                                        .id(ElementId::Name(format!("btn-resolve-{}", path).into()))
                                        .px_1p5()
                                        .py_0p5()
                                        .rounded_sm()
                                        .bg(gpui::hsla(0.12, 0.70, 0.35, 0.6))
                                        .text_color(gpui::hsla(0.12, 0.90, 0.85, 1.0))
                                        .text_size(px(10.0))
                                        .font_weight(FontWeight::BOLD)
                                        .cursor_pointer()
                                        .hover(|s| s.bg(gpui::hsla(0.12, 0.70, 0.45, 0.8)))
                                        .on_click(move |_, _window, cx| {
                                            let p = path.clone();
                                            view_conflict.update(cx, |this, cx| {
                                                this.open_conflict_resolver(&p, cx);
                                            });
                                        })
                                        .child("Resolve"),
                                ),
                        );
                    }
                    col
                })
                // Staged Changes Section
                .when(!status.staged_files.is_empty(), |this| {
                    let mut col = this.child(
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .px_3()
                            .py_1()
                            .bg(theme.surface)
                            .border_b_1()
                            .border_color(theme.border)
                            .child(
                                div()
                                    .text_size(px(10.0))
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(theme.text_muted)
                                    .child(format!(
                                        "STAGED CHANGES ({})",
                                        status.staged_files.len()
                                    )),
                            )
                            .child(
                                div()
                                    .id("btn-unstage-all")
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .size(px(16.0))
                                    .rounded_sm()
                                    .text_size(px(11.0))
                                    .text_color(theme.text_muted)
                                    .cursor_pointer()
                                    .hover(|s| {
                                        s.bg(theme.surface_hover).text_color(theme.text_primary)
                                    })
                                    .on_click(move |_, _window, cx| {
                                        view_unstage_all.update(cx, |this, cx| {
                                            this.git_unstage_files(&[], cx);
                                        });
                                    })
                                    .child("－"),
                            ),
                    );

                    for file in &status.staged_files {
                        let path = file.path.clone();
                        let view_unstage = view.clone();
                        let badge_char = match file.status.as_str() {
                            "added" => "A",
                            "deleted" => "D",
                            "renamed" => "R",
                            _ => "M",
                        };
                        let badge_color = match file.status.as_str() {
                            "added" => gpui::hsla(0.38, 0.70, 0.50, 1.0),
                            "deleted" => gpui::hsla(0.0, 0.70, 0.50, 1.0),
                            _ => gpui::hsla(0.60, 0.70, 0.50, 1.0),
                        };

                        col = col.child(
                            div()
                                .id(ElementId::Name(format!("staged-file-{}", path).into()))
                                .flex()
                                .items_center()
                                .justify_between()
                                .px_3()
                                .py_1()
                                .text_size(px(11.0))
                                .hover(|s| s.bg(theme.surface_hover))
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_1p5()
                                        .child(
                                            div()
                                                .text_size(px(10.0))
                                                .font_weight(FontWeight::BOLD)
                                                .text_color(badge_color)
                                                .child(badge_char),
                                        )
                                        .child(
                                            div()
                                                .text_color(theme.text_primary)
                                                .child(path.clone()),
                                        ),
                                )
                                .child(
                                    div()
                                        .id(ElementId::Name(format!("btn-unstage-{}", path).into()))
                                        .flex()
                                        .items_center()
                                        .justify_center()
                                        .size(px(16.0))
                                        .rounded_sm()
                                        .text_size(px(11.0))
                                        .text_color(theme.text_muted)
                                        .cursor_pointer()
                                        .hover(|s| {
                                            s.bg(theme.border).text_color(theme.text_primary)
                                        })
                                        .on_click(move |_, _window, cx| {
                                            let p = path.clone();
                                            view_unstage.update(cx, |this, cx| {
                                                this.git_unstage_files(&[p], cx);
                                            });
                                        })
                                        .child("－"),
                                ),
                        );
                    }
                    col
                })
                // Unstaged Changes Section
                .when(
                    !status.unstaged_files.is_empty() || !status.untracked_files.is_empty(),
                    |this| {
                        let total_unstaged =
                            status.unstaged_files.len() + status.untracked_files.len();
                        let mut col = this.child(
                            div()
                                .flex()
                                .items_center()
                                .justify_between()
                                .px_3()
                                .py_1()
                                .bg(theme.surface)
                                .border_b_1()
                                .border_color(theme.border)
                                .child(
                                    div()
                                        .text_size(px(10.0))
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(theme.text_muted)
                                        .child(format!("CHANGES ({})", total_unstaged)),
                                )
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_1()
                                        // Discard all changes
                                        .child(
                                            div()
                                                .id("btn-discard-all")
                                                .flex()
                                                .items_center()
                                                .justify_center()
                                                .size(px(16.0))
                                                .rounded_sm()
                                                .text_size(px(11.0))
                                                .text_color(theme.text_muted)
                                                .cursor_pointer()
                                                .hover(|s| {
                                                    s.bg(theme.surface_hover)
                                                        .text_color(theme.text_primary)
                                                })
                                                .on_click(move |_, _window, cx| {
                                                    view_discard_all.update(cx, |this, cx| {
                                                        this.git_discard_files(&[], cx);
                                                    });
                                                })
                                                .child("↺"),
                                        )
                                        // Stage all changes
                                        .child(
                                            div()
                                                .id("btn-stage-all")
                                                .flex()
                                                .items_center()
                                                .justify_center()
                                                .size(px(16.0))
                                                .rounded_sm()
                                                .text_size(px(11.0))
                                                .text_color(theme.text_muted)
                                                .cursor_pointer()
                                                .hover(|s| {
                                                    s.bg(theme.surface_hover)
                                                        .text_color(theme.text_primary)
                                                })
                                                .on_click(move |_, _window, cx| {
                                                    view_stage_all.update(cx, |this, cx| {
                                                        this.git_stage_files(&[], cx);
                                                    });
                                                })
                                                .child("＋"),
                                        ),
                                ),
                        );

                        for file in git_state.all_unstaged_files() {
                            let path = file.path.clone();
                            let path_discard = path.clone();
                            let path_stage = path.clone();
                            let view_stage = view.clone();
                            let view_discard = view.clone();
                            let badge_char = match file.status.as_str() {
                                "untracked" => "?",
                                "deleted" => "D",
                                _ => "M",
                            };
                            let badge_color = match file.status.as_str() {
                                "untracked" => gpui::hsla(0.38, 0.70, 0.50, 1.0),
                                "deleted" => gpui::hsla(0.0, 0.70, 0.50, 1.0),
                                _ => gpui::hsla(0.12, 0.70, 0.50, 1.0),
                            };

                            col = col.child(
                                div()
                                    .id(ElementId::Name(format!("unstaged-file-{}", path).into()))
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .px_3()
                                    .py_1()
                                    .text_size(px(11.0))
                                    .hover(|s| s.bg(theme.surface_hover))
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_1p5()
                                            .child(
                                                div()
                                                    .text_size(px(10.0))
                                                    .font_weight(FontWeight::BOLD)
                                                    .text_color(badge_color)
                                                    .child(badge_char),
                                            )
                                            .child(
                                                div()
                                                    .text_color(theme.text_primary)
                                                    .child(path.clone()),
                                            ),
                                    )
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_1()
                                            // Discard single file
                                            .child(
                                                div()
                                                    .id(ElementId::Name(
                                                        format!("btn-discard-{}", path_discard)
                                                            .into(),
                                                    ))
                                                    .flex()
                                                    .items_center()
                                                    .justify_center()
                                                    .size(px(16.0))
                                                    .rounded_sm()
                                                    .text_size(px(11.0))
                                                    .text_color(theme.text_muted)
                                                    .cursor_pointer()
                                                    .hover(|s| {
                                                        s.bg(theme.border)
                                                            .text_color(theme.text_primary)
                                                    })
                                                    .on_click(move |_, _window, cx| {
                                                        let p = path_discard.clone();
                                                        view_discard.update(cx, |this, cx| {
                                                            this.git_discard_files(&[p], cx);
                                                        });
                                                    })
                                                    .child("↺"),
                                            )
                                            // Stage single file
                                            .child(
                                                div()
                                                    .id(ElementId::Name(
                                                        format!("btn-stage-{}", path_stage).into(),
                                                    ))
                                                    .flex()
                                                    .items_center()
                                                    .justify_center()
                                                    .size(px(16.0))
                                                    .rounded_sm()
                                                    .text_size(px(11.0))
                                                    .text_color(theme.text_muted)
                                                    .cursor_pointer()
                                                    .hover(|s| {
                                                        s.bg(theme.border)
                                                            .text_color(theme.text_primary)
                                                    })
                                                    .on_click(move |_, _window, cx| {
                                                        let p = path_stage.clone();
                                                        view_stage.update(cx, |this, cx| {
                                                            this.git_stage_files(&[p], cx);
                                                        });
                                                    })
                                                    .child("＋"),
                                            ),
                                    ),
                            );
                        }
                        col
                    },
                )
                // Clean state indicator
                .when(status.is_clean, |this| {
                    this.flex()
                        .flex_col()
                        .items_center()
                        .justify_center()
                        .p_4()
                        .gap_1()
                        .child(
                            div()
                                .text_xs()
                                .text_color(theme.text_muted)
                                .child("No changes detected"),
                        )
                        .child(
                            div()
                                .text_size(px(10.0))
                                .text_color(theme.text_muted)
                                .child("Working tree is clean"),
                        )
                }),
        )
        // Bottom Branch Bar & Sync Status
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .h(px(28.0))
                .px_3()
                .bg(theme.surface)
                .border_t_1()
                .border_color(theme.border)
                .child(
                    div()
                        .id("btn-git-branch-selector")
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .cursor_pointer()
                        .text_size(px(11.0))
                        .text_color(theme.text_primary)
                        .hover(|s| s.text_color(theme.primary))
                        .on_click(move |_, _window, cx| {
                            view_branch_toggle.update(cx, |this, cx| {
                                this.git_open_branch_picker(cx);
                            });
                        })
                        .child("🌿")
                        .child(branch_name)
                        .child(
                            div()
                                .text_size(px(9.0))
                                .text_color(theme.text_muted)
                                .child("⌄"),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        .text_size(px(10.0))
                        .text_color(theme.text_muted)
                        .when(ahead_count > 0, |this| {
                            this.child(format!("↑ {}", ahead_count))
                        })
                        .when(behind_count > 0, |this| {
                            this.child(format!("↓ {}", behind_count))
                        }),
                ),
        )
}

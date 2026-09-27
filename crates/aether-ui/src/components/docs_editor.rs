//! Markdown Documentation Editor & Viewer Component.
//!
//! Provides interactive 3-mode editing (Edit | Split | Preview),
//! a markdown formatting toolbar, and a native GPUI markdown renderer.

use crate::components::text_area::TextArea;
use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocsMode {
    Edit,
    Split,
    Preview,
}

/// Renders the Markdown Docs Editor and Preview with mode switcher and formatting toolbar.
pub fn render_docs_editor(
    content: &str,
    mode: DocsMode,
    theme: &Theme,
    view: Entity<WorkspaceView>,
    docs_editor: Entity<TextArea>,
) -> impl IntoElement {
    let view_mode_edit = view.clone();
    let view_mode_split = view.clone();
    let view_mode_preview = view.clone();

    div()
        .flex()
        .flex_col()
        .size_full()
        .overflow_hidden()
        // Top Toolbar: Mode buttons + Formatting helpers
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
                // Mode Switcher (Edit | Split | Preview)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1()
                        .child(
                            div()
                                .id("btn-docs-mode-edit")
                                .px_2()
                                .py_0p5()
                                .rounded_sm()
                                .text_size(px(11.0))
                                .cursor_pointer()
                                .when(mode == DocsMode::Edit, |this| {
                                    this.bg(theme.surface_hover)
                                        .text_color(theme.primary)
                                        .font_weight(FontWeight::BOLD)
                                })
                                .when(mode != DocsMode::Edit, |this| {
                                    this.text_color(theme.text_secondary).hover(|s| {
                                        s.bg(theme.surface_hover).text_color(theme.text_primary)
                                    })
                                })
                                .on_click(move |_, _window, cx| {
                                    view_mode_edit.update(cx, |this, cx| {
                                        this.set_docs_mode(DocsMode::Edit, cx);
                                    });
                                })
                                .child("Edit"),
                        )
                        .child(
                            div()
                                .id("btn-docs-mode-split")
                                .px_2()
                                .py_0p5()
                                .rounded_sm()
                                .text_size(px(11.0))
                                .cursor_pointer()
                                .when(mode == DocsMode::Split, |this| {
                                    this.bg(theme.surface_hover)
                                        .text_color(theme.primary)
                                        .font_weight(FontWeight::BOLD)
                                })
                                .when(mode != DocsMode::Split, |this| {
                                    this.text_color(theme.text_secondary).hover(|s| {
                                        s.bg(theme.surface_hover).text_color(theme.text_primary)
                                    })
                                })
                                .on_click(move |_, _window, cx| {
                                    view_mode_split.update(cx, |this, cx| {
                                        this.set_docs_mode(DocsMode::Split, cx);
                                    });
                                })
                                .child("Split"),
                        )
                        .child(
                            div()
                                .id("btn-docs-mode-preview")
                                .px_2()
                                .py_0p5()
                                .rounded_sm()
                                .text_size(px(11.0))
                                .cursor_pointer()
                                .when(mode == DocsMode::Preview, |this| {
                                    this.bg(theme.surface_hover)
                                        .text_color(theme.primary)
                                        .font_weight(FontWeight::BOLD)
                                })
                                .when(mode != DocsMode::Preview, |this| {
                                    this.text_color(theme.text_secondary).hover(|s| {
                                        s.bg(theme.surface_hover).text_color(theme.text_primary)
                                    })
                                })
                                .on_click(move |_, _window, cx| {
                                    view_mode_preview.update(cx, |this, cx| {
                                        this.set_docs_mode(DocsMode::Preview, cx);
                                    });
                                })
                                .child("Preview"),
                        ),
                )
                // Formatting toolbar (visible in Edit and Split modes)
                .when(mode != DocsMode::Preview, |this| {
                    this.child(
                        div()
                            .flex()
                            .items_center()
                            .gap_1()
                            .child(render_toolbar_btn(
                                "btn-doc-bold",
                                "B",
                                "**bold**",
                                docs_editor.clone(),
                                theme,
                            ))
                            .child(render_toolbar_btn(
                                "btn-doc-italic",
                                "I",
                                "*italic*",
                                docs_editor.clone(),
                                theme,
                            ))
                            .child(render_toolbar_btn(
                                "btn-doc-h1",
                                "H1",
                                "\n# Heading 1\n",
                                docs_editor.clone(),
                                theme,
                            ))
                            .child(render_toolbar_btn(
                                "btn-doc-h2",
                                "H2",
                                "\n## Heading 2\n",
                                docs_editor.clone(),
                                theme,
                            ))
                            .child(render_toolbar_btn(
                                "btn-doc-code",
                                "</>",
                                "\n```\ncode\n```\n",
                                docs_editor.clone(),
                                theme,
                            ))
                            .child(render_toolbar_btn(
                                "btn-doc-link",
                                "🔗",
                                "[Link Title](https://example.com)",
                                docs_editor.clone(),
                                theme,
                            ))
                            .child(render_toolbar_btn(
                                "btn-doc-list",
                                "•",
                                "\n- Item 1\n- Item 2\n",
                                docs_editor.clone(),
                                theme,
                            ))
                            .child(render_toolbar_btn(
                                "btn-doc-table",
                                "⊞",
                                "\n| Column 1 | Column 2 |\n|---|---|\n| Data 1 | Data 2 |\n",
                                docs_editor.clone(),
                                theme,
                            )),
                    )
                }),
        )
        // Content Area based on Mode
        .child(
            div()
                .flex()
                .flex_1()
                .size_full()
                .overflow_hidden()
                .when(mode == DocsMode::Edit, |this| {
                    this.child(div().size_full().p_2().child(docs_editor.clone()))
                })
                .when(mode == DocsMode::Split, |this| {
                    this.child(
                        div()
                            .flex()
                            .size_full()
                            // Left Pane: Editor
                            .child(
                                div()
                                    .flex_1()
                                    .h_full()
                                    .p_2()
                                    .border_r_1()
                                    .border_color(theme.border)
                                    .child(docs_editor.clone()),
                            )
                            // Right Pane: Preview
                            .child(
                                div()
                                    .flex_1()
                                    .h_full()
                                    .overflow_y_hidden()
                                    .p_4()
                                    .bg(theme.surface)
                                    .child(render_markdown_preview(content, theme)),
                            ),
                    )
                })
                .when(mode == DocsMode::Preview, |this| {
                    this.child(
                        div()
                            .size_full()
                            .overflow_y_hidden()
                            .p_6()
                            .bg(theme.surface)
                            .child(render_markdown_preview(content, theme)),
                    )
                }),
        )
}

/// Helper for rendering formatting toolbar action buttons.
fn render_toolbar_btn(
    id: &'static str,
    label: &'static str,
    insert_text: &'static str,
    editor: Entity<TextArea>,
    theme: &Theme,
) -> impl IntoElement {
    div()
        .id(id)
        .flex()
        .items_center()
        .justify_center()
        .size(px(22.0))
        .rounded_sm()
        .bg(theme.surface_hover)
        .text_size(px(11.0))
        .font_weight(FontWeight::BOLD)
        .text_color(theme.text_secondary)
        .cursor_pointer()
        .hover(|s| s.bg(theme.border).text_color(theme.text_primary))
        .on_click(move |_, _window, cx| {
            editor.update(cx, |input, cx| {
                let cur = input.value().to_string();
                let new_val = format!("{}{}", cur, insert_text);
                input.set_value(&new_val, cx);
            });
        })
        .child(label)
}

/// Native GPUI Markdown preview renderer.
pub fn render_markdown_preview(markdown: &str, theme: &Theme) -> Div {
    let mut container = div().flex().flex_col().gap_2().w_full();

    if markdown.trim().is_empty() {
        return container.child(
            div()
                .text_xs()
                .text_color(theme.text_muted)
                .italic()
                .child("No documentation provided. Switch to Edit mode to write markdown docs."),
        );
    }

    let mut in_code_block = false;
    let mut code_block_lines = Vec::new();

    for line in markdown.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("```") {
            if in_code_block {
                // End code block
                let code_content = code_block_lines.join("\n");
                code_block_lines.clear();
                in_code_block = false;

                container = container.child(
                    div()
                        .p_3()
                        .rounded_sm()
                        .bg(gpui::hsla(0.0, 0.0, 0.08, 1.0))
                        .border_1()
                        .border_color(theme.border)
                        .text_size(px(11.0))
                        .font_family("monospace")
                        .text_color(gpui::hsla(0.38, 0.70, 0.65, 1.0))
                        .child(code_content),
                );
            } else {
                // Start code block
                in_code_block = true;
            }
            continue;
        }

        if in_code_block {
            code_block_lines.push(line);
            continue;
        }

        if trimmed.is_empty() {
            container = container.child(div().h(px(6.0)));
            continue;
        }

        // Headings
        if let Some(h1) = trimmed.strip_prefix("# ") {
            container = container.child(
                div()
                    .text_xl()
                    .font_weight(FontWeight::BOLD)
                    .text_color(theme.text_primary)
                    .pb_1()
                    .border_b_1()
                    .border_color(theme.border)
                    .child(h1.to_string()),
            );
        } else if let Some(h2) = trimmed.strip_prefix("## ") {
            container = container.child(
                div()
                    .text_base()
                    .font_weight(FontWeight::BOLD)
                    .text_color(theme.text_primary)
                    .pt_2()
                    .child(h2.to_string()),
            );
        } else if let Some(h3) = trimmed.strip_prefix("### ") {
            container = container.child(
                div()
                    .text_sm()
                    .font_weight(FontWeight::BOLD)
                    .text_color(theme.text_secondary)
                    .pt_1()
                    .child(h3.to_string()),
            );
        } else if let Some(quote) = trimmed.strip_prefix("> ") {
            container = container.child(
                div()
                    .flex()
                    .pl_3()
                    .py_1()
                    .border_l_2()
                    .border_color(theme.primary)
                    .bg(gpui::hsla(0.60, 0.30, 0.20, 0.15))
                    .text_xs()
                    .italic()
                    .text_color(theme.text_secondary)
                    .child(quote.to_string()),
            );
        } else if let Some(bullet) = trimmed
            .strip_prefix("- ")
            .or_else(|| trimmed.strip_prefix("* "))
        {
            container = container.child(
                div()
                    .flex()
                    .items_start()
                    .gap_2()
                    .pl_2()
                    .text_xs()
                    .text_color(theme.text_primary)
                    .child(div().text_color(theme.primary).child("•"))
                    .child(div().child(bullet.to_string())),
            );
        } else if trimmed == "---" || trimmed == "***" {
            container = container.child(div().w_full().h(px(1.0)).my_2().bg(theme.border));
        } else {
            // Standard Paragraph
            container = container.child(
                div()
                    .text_xs()
                    .line_height(relative(1.5))
                    .text_color(theme.text_primary)
                    .child(trimmed.to_string()),
            );
        }
    }

    // Flush any open code block
    if in_code_block && !code_block_lines.is_empty() {
        let code_content = code_block_lines.join("\n");
        container = container.child(
            div()
                .p_3()
                .rounded_sm()
                .bg(gpui::hsla(0.0, 0.0, 0.08, 1.0))
                .border_1()
                .border_color(theme.border)
                .text_size(px(11.0))
                .font_family("monospace")
                .text_color(gpui::hsla(0.38, 0.70, 0.65, 1.0))
                .child(code_content),
        );
    }

    container
}

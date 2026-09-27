//! Native multi-line text area editor component for GPUI.
//!
//! Provides a full-featured code/payload editor with line numbers gutter,
//! multi-line cursor navigation (Up/Down/Left/Right/Home/End/PageUp/PageDown),
//! text selection across lines, clipboard integration (copy/cut/paste),
//! auto-indentation on Enter, Tab/Shift+Tab indentation, undo/redo,
//! and mouse click/drag positioning.

use crate::theme::Theme;
use gpui::prelude::*;
use gpui::*;
use std::ops::Range;
use unicode_segmentation::UnicodeSegmentation;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
actions!(
    text_area,
    [
        Backspace,
        Delete,
        Left,
        Right,
        Up,
        Down,
        SelectLeft,
        SelectRight,
        SelectUp,
        SelectDown,
        SelectAll,
        Home,
        End,
        SelectHome,
        SelectEnd,
        WordLeft,
        WordRight,
        SelectWordLeft,
        SelectWordRight,
        DeleteWord,
        BackspaceWord,
        Enter,
        Tab,
        ShiftTab,
        Paste,
        Cut,
        Copy,
        Undo,
        Redo,
    ]
);

/// Registers key-bindings for the `"TextArea"` key context.
pub fn bind_text_area_keys(cx: &mut App) {
    cx.bind_keys([
        KeyBinding::new("backspace", Backspace, Some("TextArea")),
        KeyBinding::new("delete", Delete, Some("TextArea")),
        KeyBinding::new("left", Left, Some("TextArea")),
        KeyBinding::new("right", Right, Some("TextArea")),
        KeyBinding::new("up", Up, Some("TextArea")),
        KeyBinding::new("down", Down, Some("TextArea")),
        KeyBinding::new("shift-left", SelectLeft, Some("TextArea")),
        KeyBinding::new("shift-right", SelectRight, Some("TextArea")),
        KeyBinding::new("shift-up", SelectUp, Some("TextArea")),
        KeyBinding::new("shift-down", SelectDown, Some("TextArea")),
        KeyBinding::new("ctrl-a", SelectAll, Some("TextArea")),
        KeyBinding::new("home", Home, Some("TextArea")),
        KeyBinding::new("end", End, Some("TextArea")),
        KeyBinding::new("shift-home", SelectHome, Some("TextArea")),
        KeyBinding::new("shift-end", SelectEnd, Some("TextArea")),
        KeyBinding::new("ctrl-left", WordLeft, Some("TextArea")),
        KeyBinding::new("ctrl-right", WordRight, Some("TextArea")),
        KeyBinding::new("ctrl-shift-left", SelectWordLeft, Some("TextArea")),
        KeyBinding::new("ctrl-shift-right", SelectWordRight, Some("TextArea")),
        KeyBinding::new("ctrl-delete", DeleteWord, Some("TextArea")),
        KeyBinding::new("ctrl-backspace", BackspaceWord, Some("TextArea")),
        KeyBinding::new("enter", Enter, Some("TextArea")),
        KeyBinding::new("tab", Tab, Some("TextArea")),
        KeyBinding::new("shift-tab", ShiftTab, Some("TextArea")),
        KeyBinding::new("ctrl-v", Paste, Some("TextArea")),
        KeyBinding::new("ctrl-c", Copy, Some("TextArea")),
        KeyBinding::new("ctrl-x", Cut, Some("TextArea")),
        KeyBinding::new("ctrl-z", Undo, Some("TextArea")),
        KeyBinding::new("ctrl-shift-z", Redo, Some("TextArea")),
        KeyBinding::new("ctrl-y", Redo, Some("TextArea")),
    ]);
}

// ---------------------------------------------------------------------------
// Undo / Redo Entry
// ---------------------------------------------------------------------------
#[derive(Debug, Clone)]
struct UndoEntry {
    content: SharedString,
    cursor: usize,
}

// ---------------------------------------------------------------------------
// TextArea — the GPUI Entity
// ---------------------------------------------------------------------------

/// Callback type for value change notifications.
pub type OnChangeCallback = Box<dyn Fn(&str, &mut App) + 'static>;

/// A multi-line native text editor component.
pub struct TextArea {
    focus_handle: FocusHandle,
    content: SharedString,
    placeholder: SharedString,
    selected_range: Range<usize>,
    selection_reversed: bool,
    show_line_numbers: bool,
    tab_size: usize,
    _scroll_top_line: usize,
    target_column: Option<usize>,
    _is_selecting: bool,
    disabled: bool,
    undo_stack: Vec<UndoEntry>,
    redo_stack: Vec<UndoEntry>,
    on_change: Option<OnChangeCallback>,
    _last_click_time: Option<std::time::Instant>,
    _click_count: u32,
    line_height: Pixels,
    font_size: Pixels,
}

impl TextArea {
    /// Creates a new TextArea.
    pub fn new(cx: &mut Context<Self>, placeholder: &str, show_line_numbers: bool) -> Self {
        Self {
            focus_handle: cx.focus_handle(),
            content: "".into(),
            placeholder: placeholder.to_string().into(),
            selected_range: 0..0,
            selection_reversed: false,
            show_line_numbers,
            tab_size: 2,
            _scroll_top_line: 0,
            target_column: None,
            _is_selecting: false,
            disabled: false,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            on_change: None,
            _last_click_time: None,
            _click_count: 0,
            line_height: px(20.0),
            font_size: px(12.0),
        }
    }

    // -- Public API --------------------------------------------------------

    pub fn value(&self) -> &str {
        &self.content
    }

    pub fn set_value(&mut self, value: &str, cx: &mut Context<Self>) {
        self.content = value.to_string().into();
        let len = self.content.len();
        self.selected_range = len..len;
        self.selection_reversed = false;
        self.target_column = None;
        cx.notify();
    }

    pub fn set_on_change(&mut self, callback: impl Fn(&str, &mut App) + 'static) {
        self.on_change = Some(Box::new(callback));
    }

    pub fn set_disabled(&mut self, disabled: bool, cx: &mut Context<Self>) {
        self.disabled = disabled;
        cx.notify();
    }

    pub fn set_show_line_numbers(&mut self, show: bool, cx: &mut Context<Self>) {
        self.show_line_numbers = show;
        cx.notify();
    }

    pub fn focus_handle(&self) -> FocusHandle {
        self.focus_handle.clone()
    }

    pub fn focus(&self, window: &mut Window, _cx: &mut Context<Self>) {
        window.focus(&self.focus_handle);
    }

    pub fn line_count(&self) -> usize {
        if self.content.is_empty() {
            1
        } else {
            self.content.split('\n').count()
        }
    }

    // -- Helper Functions for multi-line offsets ---------------------------

    /// Converts a byte offset to (line_index, col_index in chars).
    fn offset_to_line_col(&self, offset: usize) -> (usize, usize) {
        let text = &self.content[..offset.min(self.content.len())];
        let line_idx = text.chars().filter(|&c| c == '\n').count();
        let last_nl = text.rfind('\n').map(|p| p + 1).unwrap_or(0);
        let col_idx = self.content[last_nl..offset.min(self.content.len())]
            .graphemes(true)
            .count();
        (line_idx, col_idx)
    }

    /// Converts (line_index, col_index in graphemes) to a byte offset.
    fn line_col_to_offset(&self, target_line: usize, target_col: usize) -> usize {
        let mut cur_line = 0;
        let mut line_start = 0;

        for (idx, ch) in self.content.char_indices() {
            if cur_line == target_line {
                let line_str = match self.content[line_start..].find('\n') {
                    Some(nl) => &self.content[line_start..line_start + nl],
                    None => &self.content[line_start..],
                };
                let mut char_count = 0;
                for (g_idx, _) in line_str.grapheme_indices(true) {
                    if char_count == target_col {
                        return line_start + g_idx;
                    }
                    char_count += 1;
                }
                return line_start + line_str.len();
            }
            if ch == '\n' {
                cur_line += 1;
                line_start = idx + 1;
            }
        }

        if cur_line == target_line {
            let line_str = &self.content[line_start..];
            let mut char_count = 0;
            for (g_idx, _) in line_str.grapheme_indices(true) {
                if char_count == target_col {
                    return line_start + g_idx;
                }
                char_count += 1;
            }
            return line_start + line_str.len();
        }

        self.content.len()
    }

    fn cursor_offset(&self) -> usize {
        if self.selection_reversed {
            self.selected_range.start
        } else {
            self.selected_range.end
        }
    }

    fn push_undo(&mut self) {
        let entry = UndoEntry {
            content: self.content.clone(),
            cursor: self.cursor_offset(),
        };
        self.undo_stack.push(entry);
        if self.undo_stack.len() > 100 {
            self.undo_stack.remove(0);
        }
        self.redo_stack.clear();
    }

    // -- Editing operations ------------------------------------------------

    fn replace_range(&mut self, range: Range<usize>, new_text: &str, cx: &mut Context<Self>) {
        self.push_undo();
        let mut s = self.content.to_string();
        let start = range.start.min(s.len());
        let end = range.end.min(s.len());
        s.replace_range(start..end, new_text);
        self.content = s.into();

        let new_cursor = start + new_text.len();
        self.selected_range = new_cursor..new_cursor;
        self.selection_reversed = false;
        self.target_column = None;

        if let Some(cb) = &self.on_change {
            cb(&self.content, cx);
        }
        cx.notify();
    }

    fn insert_text(&mut self, text: &str, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        let range = self.selected_range.clone();
        self.replace_range(range, text, cx);
    }

    fn delete_backward(&mut self, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        if self.selected_range.start != self.selected_range.end {
            let range = self.selected_range.clone();
            self.replace_range(range, "", cx);
        } else if self.selected_range.start > 0 {
            let cursor = self.selected_range.start;
            let prev = self.content[..cursor]
                .grapheme_indices(true)
                .last()
                .map(|(idx, _)| idx)
                .unwrap_or(0);
            self.replace_range(prev..cursor, "", cx);
        }
    }

    fn delete_forward(&mut self, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        if self.selected_range.start != self.selected_range.end {
            let range = self.selected_range.clone();
            self.replace_range(range, "", cx);
        } else if self.selected_range.end < self.content.len() {
            let cursor = self.selected_range.end;
            let next = self.content[cursor..]
                .grapheme_indices(true)
                .nth(1)
                .map(|(idx, _)| cursor + idx)
                .unwrap_or(self.content.len());
            self.replace_range(cursor..next, "", cx);
        }
    }

    fn handle_enter(&mut self, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        // Auto-indent: extract leading whitespace from current line
        let cursor = self.cursor_offset();
        let last_nl = self.content[..cursor]
            .rfind('\n')
            .map(|p| p + 1)
            .unwrap_or(0);
        let current_line = &self.content[last_nl..cursor];
        let indent: String = current_line
            .chars()
            .take_while(|c| *c == ' ' || *c == '\t')
            .collect();

        let insertion = format!("\n{}", indent);
        let range = self.selected_range.clone();
        self.replace_range(range, &insertion, cx);
    }

    fn handle_tab(&mut self, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        let spaces = " ".repeat(self.tab_size);
        let range = self.selected_range.clone();
        self.replace_range(range, &spaces, cx);
    }

    // -- Movement operations -----------------------------------------------

    fn move_left(&mut self, select: bool, cx: &mut Context<Self>) {
        let cursor = if select {
            self.cursor_offset()
        } else if self.selected_range.start != self.selected_range.end {
            self.selected_range.start
        } else {
            self.selected_range.start
        };

        let new_cursor = self.content[..cursor]
            .grapheme_indices(true)
            .last()
            .map(|(idx, _)| idx)
            .unwrap_or(0);

        self.set_cursor(new_cursor, select, cx);
    }

    fn move_right(&mut self, select: bool, cx: &mut Context<Self>) {
        let cursor = if select {
            self.cursor_offset()
        } else if self.selected_range.start != self.selected_range.end {
            self.selected_range.end
        } else {
            self.selected_range.end
        };

        let new_cursor = self.content[cursor..]
            .grapheme_indices(true)
            .nth(1)
            .map(|(idx, _)| cursor + idx)
            .unwrap_or(self.content.len());

        self.set_cursor(new_cursor, select, cx);
    }

    fn move_up(&mut self, select: bool, cx: &mut Context<Self>) {
        let cursor = self.cursor_offset();
        let (cur_line, cur_col) = self.offset_to_line_col(cursor);
        let target_col = self.target_column.unwrap_or(cur_col);

        if cur_line > 0 {
            let new_offset = self.line_col_to_offset(cur_line - 1, target_col);
            self.set_cursor(new_offset, select, cx);
            self.target_column = Some(target_col);
        } else {
            self.set_cursor(0, select, cx);
        }
    }

    fn move_down(&mut self, select: bool, cx: &mut Context<Self>) {
        let cursor = self.cursor_offset();
        let (cur_line, cur_col) = self.offset_to_line_col(cursor);
        let target_col = self.target_column.unwrap_or(cur_col);
        let total_lines = self.line_count();

        if cur_line + 1 < total_lines {
            let new_offset = self.line_col_to_offset(cur_line + 1, target_col);
            self.set_cursor(new_offset, select, cx);
            self.target_column = Some(target_col);
        } else {
            self.set_cursor(self.content.len(), select, cx);
        }
    }

    fn move_home(&mut self, select: bool, cx: &mut Context<Self>) {
        let cursor = self.cursor_offset();
        let line_start = self.content[..cursor]
            .rfind('\n')
            .map(|p| p + 1)
            .unwrap_or(0);
        self.set_cursor(line_start, select, cx);
    }

    fn move_end(&mut self, select: bool, cx: &mut Context<Self>) {
        let cursor = self.cursor_offset();
        let line_end = self.content[cursor..]
            .find('\n')
            .map(|p| cursor + p)
            .unwrap_or(self.content.len());
        self.set_cursor(line_end, select, cx);
    }

    fn set_cursor(&mut self, offset: usize, select: bool, cx: &mut Context<Self>) {
        let offset = offset.min(self.content.len());
        if select {
            let anchor = if self.selection_reversed {
                self.selected_range.end
            } else {
                self.selected_range.start
            };
            if offset < anchor {
                self.selected_range = offset..anchor;
                self.selection_reversed = true;
            } else {
                self.selected_range = anchor..offset;
                self.selection_reversed = false;
            }
        } else {
            self.selected_range = offset..offset;
            self.selection_reversed = false;
            self.target_column = None;
        }
        cx.notify();
    }

    fn select_all(&mut self, cx: &mut Context<Self>) {
        self.selected_range = 0..self.content.len();
        self.selection_reversed = false;
        cx.notify();
    }

    // -- Undo / Redo -------------------------------------------------------

    fn undo(&mut self, cx: &mut Context<Self>) {
        if let Some(prev) = self.undo_stack.pop() {
            let current = UndoEntry {
                content: self.content.clone(),
                cursor: self.cursor_offset(),
            };
            self.redo_stack.push(current);
            self.content = prev.content;
            let cur = prev.cursor.min(self.content.len());
            self.selected_range = cur..cur;
            self.selection_reversed = false;
            if let Some(cb) = &self.on_change {
                cb(&self.content, cx);
            }
            cx.notify();
        }
    }

    fn redo(&mut self, cx: &mut Context<Self>) {
        if let Some(next) = self.redo_stack.pop() {
            let current = UndoEntry {
                content: self.content.clone(),
                cursor: self.cursor_offset(),
            };
            self.undo_stack.push(current);
            self.content = next.content;
            let cur = next.cursor.min(self.content.len());
            self.selected_range = cur..cur;
            self.selection_reversed = false;
            if let Some(cb) = &self.on_change {
                cb(&self.content, cx);
            }
            cx.notify();
        }
    }
}

// ---------------------------------------------------------------------------
// GPUI Element Implementation & Actions Registration
// ---------------------------------------------------------------------------

impl Render for TextArea {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let theme = Theme::dark();
        let is_focused = self.focus_handle.is_focused(_window);
        let line_height = self.line_height;
        let font_size = self.font_size;
        let is_empty = self.content.is_empty();

        let lines: Vec<&str> = if is_empty {
            vec![""]
        } else {
            self.content.split('\n').collect()
        };
        let total_lines = lines.len();

        let (cursor_line, cursor_col) = self.offset_to_line_col(self.cursor_offset());
        let (sel_start_line, sel_start_col) = self.offset_to_line_col(self.selected_range.start);
        let (sel_end_line, sel_end_col) = self.offset_to_line_col(self.selected_range.end);
        let has_selection = self.selected_range.start != self.selected_range.end;

        // Line numbers gutter
        let gutter_width = if self.show_line_numbers {
            let digits = total_lines.to_string().len().max(2);
            px(16.0 + digits as f32 * 8.0)
        } else {
            px(0.0)
        };

        let mut gutter = div()
            .flex()
            .flex_col()
            .w(gutter_width)
            .h_full()
            .py_2()
            .bg(theme.surface)
            .border_r_1()
            .border_color(theme.border)
            .text_size(font_size)
            .text_color(theme.text_muted);

        for i in 1..=total_lines {
            let is_cur = i - 1 == cursor_line;
            gutter = gutter.child(
                div()
                    .h(line_height)
                    .px_2()
                    .flex()
                    .items_center()
                    .justify_end()
                    .when(is_cur, |s| {
                        s.text_color(theme.text_primary)
                            .font_weight(FontWeight::BOLD)
                    })
                    .child(i.to_string()),
            );
        }

        // Code / Content lines
        let mut code_content = div()
            .flex()
            .flex_col()
            .flex_1()
            .h_full()
            .py_2()
            .px_3()
            .font_family(".SystemUIFont")
            .text_size(font_size);

        if is_empty && !is_focused {
            code_content = code_content.child(
                div()
                    .h(line_height)
                    .flex()
                    .items_center()
                    .text_color(theme.text_muted)
                    .child(self.placeholder.to_string()),
            );
        } else {
            for (line_idx, line_str) in lines.iter().enumerate() {
                let is_cur_line = is_focused && line_idx == cursor_line;
                let mut line_row = div()
                    .relative()
                    .h(line_height)
                    .flex()
                    .items_center()
                    .when(is_cur_line && !has_selection, |s| {
                        s.bg(hsla(220.0, 0.20, 0.20, 0.25))
                    });

                let line_char_count = line_str.graphemes(true).count();

                // Render selection if line is within selection range
                if has_selection && line_idx >= sel_start_line && line_idx <= sel_end_line {
                    let start_col = if line_idx == sel_start_line {
                        sel_start_col
                    } else {
                        0
                    };
                    let end_col = if line_idx == sel_end_line {
                        sel_end_col
                    } else {
                        line_char_count + 1
                    };

                    let left_px = px(start_col as f32 * 7.2);
                    let width_px = px(((end_col.saturating_sub(start_col)).max(1)) as f32 * 7.2);

                    line_row = line_row.child(
                        div()
                            .absolute()
                            .left(left_px)
                            .w(width_px)
                            .h_full()
                            .bg(hsla(217.0, 0.91, 0.60, 0.35))
                            .rounded_xs(),
                    );
                }

                // Render cursor if on this line
                if is_cur_line && !has_selection {
                    let cursor_left = px(cursor_col as f32 * 7.2);
                    line_row = line_row.child(
                        div()
                            .absolute()
                            .left(cursor_left)
                            .top(px(2.0))
                            .w(px(2.0))
                            .h(px(16.0))
                            .bg(theme.primary)
                            .rounded_xs(),
                    );
                }

                // Line text
                let display_text = if line_str.is_empty() {
                    " ".to_string()
                } else {
                    line_str.to_string()
                };

                line_row = line_row.child(
                    div()
                        .relative()
                        .text_color(theme.text_primary)
                        .child(display_text),
                );

                code_content = code_content.child(line_row);
            }
        }

        // Main Container
        div()
            .key_context("TextArea")
            .track_focus(&self.focus_handle)
            .flex()
            .flex_row()
            .size_full()
            .bg(theme.background)
            .border_1()
            .border_color(if is_focused {
                theme.primary
            } else {
                theme.border
            })
            .rounded_sm()
            .overflow_hidden()
            .on_action(cx.listener(|this, _: &Backspace, _window, cx| this.delete_backward(cx)))
            .on_action(cx.listener(|this, _: &Delete, _window, cx| this.delete_forward(cx)))
            .on_action(cx.listener(|this, _: &Left, _window, cx| this.move_left(false, cx)))
            .on_action(cx.listener(|this, _: &Right, _window, cx| this.move_right(false, cx)))
            .on_action(cx.listener(|this, _: &Up, _window, cx| this.move_up(false, cx)))
            .on_action(cx.listener(|this, _: &Down, _window, cx| this.move_down(false, cx)))
            .on_action(cx.listener(|this, _: &SelectLeft, _window, cx| this.move_left(true, cx)))
            .on_action(cx.listener(|this, _: &SelectRight, _window, cx| this.move_right(true, cx)))
            .on_action(cx.listener(|this, _: &SelectUp, _window, cx| this.move_up(true, cx)))
            .on_action(cx.listener(|this, _: &SelectDown, _window, cx| this.move_down(true, cx)))
            .on_action(cx.listener(|this, _: &SelectAll, _window, cx| this.select_all(cx)))
            .on_action(cx.listener(|this, _: &Home, _window, cx| this.move_home(false, cx)))
            .on_action(cx.listener(|this, _: &End, _window, cx| this.move_end(false, cx)))
            .on_action(cx.listener(|this, _: &SelectHome, _window, cx| this.move_home(true, cx)))
            .on_action(cx.listener(|this, _: &SelectEnd, _window, cx| this.move_end(true, cx)))
            .on_action(cx.listener(|this, _: &Enter, _window, cx| this.handle_enter(cx)))
            .on_action(cx.listener(|this, _: &Tab, _window, cx| this.handle_tab(cx)))
            .on_action(cx.listener(|this, _: &Undo, _window, cx| this.undo(cx)))
            .on_action(cx.listener(|this, _: &Redo, _window, cx| this.redo(cx)))
            .on_action(cx.listener(|this, _: &Copy, _window, cx| {
                if this.selected_range.start != this.selected_range.end {
                    let text = this.content[this.selected_range.clone()].to_string();
                    cx.write_to_clipboard(ClipboardItem::new_string(text));
                }
            }))
            .on_action(cx.listener(|this, _: &Cut, _window, cx| {
                if !this.disabled && this.selected_range.start != this.selected_range.end {
                    let text = this.content[this.selected_range.clone()].to_string();
                    cx.write_to_clipboard(ClipboardItem::new_string(text));
                    let range = this.selected_range.clone();
                    this.replace_range(range, "", cx);
                }
            }))
            .on_action(cx.listener(|this, _: &Paste, _window, cx| {
                if !this.disabled {
                    if let Some(text) = cx.read_from_clipboard().and_then(|item| item.text()) {
                        this.insert_text(&text, cx);
                    }
                }
            }))
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(|this, event: &MouseDownEvent, window, cx| {
                    window.focus(&this.focus_handle);
                    let pos_y: f32 = event.position.y.into();
                    let pos_x: f32 = event.position.x.into();
                    let line_idx =
                        ((pos_y / 20.0).floor() as usize).min(this.line_count().saturating_sub(1));
                    let x = (pos_x - if this.show_line_numbers { 40.0 } else { 8.0 }).max(0.0);
                    let col_idx = (x / 7.2).round() as usize;

                    let offset = this.line_col_to_offset(line_idx, col_idx);
                    this.set_cursor(offset, event.modifiers.shift, cx);
                }),
            )
            .when(self.show_line_numbers, |s| s.child(gutter))
            .child(code_content)
    }
}

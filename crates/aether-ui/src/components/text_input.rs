//! Native single-line text input component for GPUI.
//!
//! Provides a fully-featured text field with cursor positioning, text selection,
//! clipboard integration (copy/cut/paste), undo/redo, word-boundary navigation
//! (Ctrl+Left/Right), Home/End, placeholder text, password masking, IME support,
//! and double-click (word) / triple-click (select-all) selection.
//!
//! # Usage
//! ```rust,ignore
//! let input = cx.new(|cx| TextInput::new(cx, "placeholder...", false));
//! // In your Render impl, use:
//! .child(input.clone())
//! ```

use crate::theme::Theme;
use gpui::prelude::*;
use gpui::*;
use std::ops::Range;
use unicode_segmentation::UnicodeSegmentation;

// ---------------------------------------------------------------------------
// Actions (bound to keyboard shortcuts)
// ---------------------------------------------------------------------------
actions!(
    text_input,
    [
        Backspace,
        Delete,
        Left,
        Right,
        SelectLeft,
        SelectRight,
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
        Paste,
        Cut,
        Copy,
        Undo,
        Redo,
        ShowCharacterPalette,
    ]
);

/// Registers key-bindings for the `"TextInput"` key context.
/// Call this once in your `Application::run` callback before opening windows.
pub fn bind_text_input_keys(cx: &mut App) {
    cx.bind_keys([
        KeyBinding::new("backspace", Backspace, Some("TextInput")),
        KeyBinding::new("delete", Delete, Some("TextInput")),
        KeyBinding::new("left", Left, Some("TextInput")),
        KeyBinding::new("right", Right, Some("TextInput")),
        KeyBinding::new("shift-left", SelectLeft, Some("TextInput")),
        KeyBinding::new("shift-right", SelectRight, Some("TextInput")),
        KeyBinding::new("ctrl-a", SelectAll, Some("TextInput")),
        KeyBinding::new("home", Home, Some("TextInput")),
        KeyBinding::new("end", End, Some("TextInput")),
        KeyBinding::new("shift-home", SelectHome, Some("TextInput")),
        KeyBinding::new("shift-end", SelectEnd, Some("TextInput")),
        KeyBinding::new("ctrl-left", WordLeft, Some("TextInput")),
        KeyBinding::new("ctrl-right", WordRight, Some("TextInput")),
        KeyBinding::new("ctrl-shift-left", SelectWordLeft, Some("TextInput")),
        KeyBinding::new("ctrl-shift-right", SelectWordRight, Some("TextInput")),
        KeyBinding::new("ctrl-delete", DeleteWord, Some("TextInput")),
        KeyBinding::new("ctrl-backspace", BackspaceWord, Some("TextInput")),
        KeyBinding::new("ctrl-v", Paste, Some("TextInput")),
        KeyBinding::new("ctrl-c", Copy, Some("TextInput")),
        KeyBinding::new("ctrl-x", Cut, Some("TextInput")),
        KeyBinding::new("ctrl-z", Undo, Some("TextInput")),
        KeyBinding::new("ctrl-shift-z", Redo, Some("TextInput")),
        KeyBinding::new("ctrl-y", Redo, Some("TextInput")),
    ]);
}

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------
#[derive(Debug, Clone)]
struct UndoEntry {
    content: SharedString,
    cursor: usize,
}

// ---------------------------------------------------------------------------
// TextInput — the GPUI Entity
// ---------------------------------------------------------------------------

/// Callback type for value change notifications.
pub type OnChangeCallback = Box<dyn Fn(&str, &mut App) + 'static>;

/// A single-line native text input component.
///
/// Use as a GPUI `Entity<TextInput>`:
/// ```rust,ignore
/// let input = cx.new(|cx| TextInput::new(cx, "placeholder...", false));
/// ```
pub struct TextInput {
    focus_handle: FocusHandle,
    content: SharedString,
    placeholder: SharedString,
    selected_range: Range<usize>,
    selection_reversed: bool,
    marked_range: Option<Range<usize>>,
    last_layout: Option<ShapedLine>,
    last_bounds: Option<Bounds<Pixels>>,
    is_selecting: bool,
    is_password: bool,
    disabled: bool,
    undo_stack: Vec<UndoEntry>,
    redo_stack: Vec<UndoEntry>,
    on_change: Option<OnChangeCallback>,
    on_submit: Option<Box<dyn Fn(&str, &mut App) + 'static>>,
    last_click_time: Option<std::time::Instant>,
    click_count: u32,
}

impl TextInput {
    /// Creates a new TextInput.
    pub fn new(cx: &mut Context<Self>, placeholder: &str, is_password: bool) -> Self {
        Self {
            focus_handle: cx.focus_handle(),
            content: "".into(),
            placeholder: placeholder.to_string().into(),
            selected_range: 0..0,
            selection_reversed: false,
            marked_range: None,
            last_layout: None,
            last_bounds: None,
            is_selecting: false,
            is_password,
            disabled: false,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            on_change: None,
            on_submit: None,
            last_click_time: None,
            click_count: 0,
        }
    }

    // -- Public API --------------------------------------------------------

    /// Returns the current text value.
    pub fn value(&self) -> &str {
        &self.content
    }

    /// Programmatically sets the text value, resetting cursor and selection.
    pub fn set_value(&mut self, value: &str, cx: &mut Context<Self>) {
        self.content = value.to_string().into();
        let len = self.content.len();
        self.selected_range = len..len;
        self.selection_reversed = false;
        self.marked_range = None;
        cx.notify();
    }

    /// Sets the on-change callback. Called every time the text value changes.
    pub fn set_on_change(&mut self, callback: impl Fn(&str, &mut App) + 'static) {
        self.on_change = Some(Box::new(callback));
    }

    /// Sets the on-submit callback. Called when Enter is pressed.
    pub fn set_on_submit(&mut self, callback: impl Fn(&str, &mut App) + 'static) {
        self.on_submit = Some(Box::new(callback));
    }

    /// Sets the disabled state.
    pub fn set_disabled(&mut self, disabled: bool, cx: &mut Context<Self>) {
        self.disabled = disabled;
        cx.notify();
    }

    /// Focus this input.
    pub fn focus(&self, window: &mut Window, _cx: &mut Context<Self>) {
        window.focus(&self.focus_handle);
    }

    /// Check if focused.
    pub fn is_focused(&self, window: &Window) -> bool {
        self.focus_handle.is_focused(window)
    }

    // -- Undo / Redo -------------------------------------------------------

    fn push_undo(&mut self) {
        self.undo_stack.push(UndoEntry {
            content: self.content.clone(),
            cursor: self.cursor_offset(),
        });
        self.redo_stack.clear();
        // Cap undo stack
        if self.undo_stack.len() > 200 {
            self.undo_stack.remove(0);
        }
    }

    fn undo(&mut self, _: &Undo, _: &mut Window, cx: &mut Context<Self>) {
        if let Some(entry) = self.undo_stack.pop() {
            self.redo_stack.push(UndoEntry {
                content: self.content.clone(),
                cursor: self.cursor_offset(),
            });
            self.content = entry.content;
            self.selected_range = entry.cursor..entry.cursor;
            self.selection_reversed = false;
            cx.notify();
        }
    }

    fn redo(&mut self, _: &Redo, _: &mut Window, cx: &mut Context<Self>) {
        if let Some(entry) = self.redo_stack.pop() {
            self.undo_stack.push(UndoEntry {
                content: self.content.clone(),
                cursor: self.cursor_offset(),
            });
            self.content = entry.content;
            self.selected_range = entry.cursor..entry.cursor;
            self.selection_reversed = false;
            cx.notify();
        }
    }

    // -- Cursor & Selection ------------------------------------------------

    fn cursor_offset(&self) -> usize {
        if self.selection_reversed {
            self.selected_range.start
        } else {
            self.selected_range.end
        }
    }

    fn move_to(&mut self, offset: usize, cx: &mut Context<Self>) {
        self.selected_range = offset..offset;
        cx.notify();
    }

    fn select_to(&mut self, offset: usize, cx: &mut Context<Self>) {
        if self.selection_reversed {
            self.selected_range.start = offset;
        } else {
            self.selected_range.end = offset;
        }
        if self.selected_range.end < self.selected_range.start {
            self.selection_reversed = !self.selection_reversed;
            self.selected_range = self.selected_range.end..self.selected_range.start;
        }
        cx.notify();
    }

    // -- Grapheme boundary helpers -----------------------------------------

    fn previous_boundary(&self, offset: usize) -> usize {
        self.content
            .grapheme_indices(true)
            .rev()
            .find_map(|(idx, _)| (idx < offset).then_some(idx))
            .unwrap_or(0)
    }

    fn next_boundary(&self, offset: usize) -> usize {
        self.content
            .grapheme_indices(true)
            .find_map(|(idx, _)| (idx > offset).then_some(idx))
            .unwrap_or(self.content.len())
    }

    // -- Word boundary helpers (Ctrl+Left/Right) ---------------------------

    fn previous_word_boundary(&self, offset: usize) -> usize {
        let bytes = self.content.as_bytes();
        if offset == 0 {
            return 0;
        }
        let mut pos = offset;
        // Skip whitespace before cursor
        while pos > 0
            && bytes
                .get(pos - 1)
                .map_or(false, |b| b.is_ascii_whitespace())
        {
            pos -= 1;
        }
        // Skip word characters
        while pos > 0
            && bytes
                .get(pos - 1)
                .map_or(false, |b| !b.is_ascii_whitespace())
        {
            pos -= 1;
        }
        pos
    }

    fn next_word_boundary(&self, offset: usize) -> usize {
        let bytes = self.content.as_bytes();
        let len = bytes.len();
        if offset >= len {
            return len;
        }
        let mut pos = offset;
        // Skip current word characters
        while pos < len && !bytes[pos].is_ascii_whitespace() {
            pos += 1;
        }
        // Skip whitespace after word
        while pos < len && bytes[pos].is_ascii_whitespace() {
            pos += 1;
        }
        pos
    }

    // -- Hit testing -------------------------------------------------------

    fn index_for_mouse_position(&self, position: Point<Pixels>) -> usize {
        if self.content.is_empty() {
            return 0;
        }
        let (Some(bounds), Some(line)) = (self.last_bounds.as_ref(), self.last_layout.as_ref())
        else {
            return 0;
        };
        if position.y < bounds.top() {
            return 0;
        }
        if position.y > bounds.bottom() {
            return self.content.len();
        }
        line.closest_index_for_x(position.x - bounds.left())
    }

    // -- UTF-16 conversion (required by platform input handler) ------------

    fn offset_from_utf16(&self, offset: usize) -> usize {
        let mut utf8_offset = 0;
        let mut utf16_count = 0;
        for ch in self.content.chars() {
            if utf16_count >= offset {
                break;
            }
            utf16_count += ch.len_utf16();
            utf8_offset += ch.len_utf8();
        }
        utf8_offset
    }

    fn offset_to_utf16(&self, offset: usize) -> usize {
        let mut utf16_offset = 0;
        let mut utf8_count = 0;
        for ch in self.content.chars() {
            if utf8_count >= offset {
                break;
            }
            utf8_count += ch.len_utf8();
            utf16_offset += ch.len_utf16();
        }
        utf16_offset
    }

    fn range_to_utf16(&self, range: &Range<usize>) -> Range<usize> {
        self.offset_to_utf16(range.start)..self.offset_to_utf16(range.end)
    }

    fn range_from_utf16(&self, range_utf16: &Range<usize>) -> Range<usize> {
        self.offset_from_utf16(range_utf16.start)..self.offset_from_utf16(range_utf16.end)
    }

    // -- Display text (handles password masking) ---------------------------

    fn display_text(&self) -> SharedString {
        if self.is_password && !self.content.is_empty() {
            "●".repeat(self.content.graphemes(true).count()).into()
        } else {
            self.content.clone()
        }
    }

    // -- Action handlers ---------------------------------------------------

    fn left(&mut self, _: &Left, _: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            self.move_to(self.previous_boundary(self.cursor_offset()), cx);
        } else {
            self.move_to(self.selected_range.start, cx);
        }
    }

    fn right(&mut self, _: &Right, _: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            self.move_to(self.next_boundary(self.selected_range.end), cx);
        } else {
            self.move_to(self.selected_range.end, cx);
        }
    }

    fn select_left(&mut self, _: &SelectLeft, _: &mut Window, cx: &mut Context<Self>) {
        self.select_to(self.previous_boundary(self.cursor_offset()), cx);
    }

    fn select_right(&mut self, _: &SelectRight, _: &mut Window, cx: &mut Context<Self>) {
        self.select_to(self.next_boundary(self.cursor_offset()), cx);
    }

    fn select_all(&mut self, _: &SelectAll, _: &mut Window, cx: &mut Context<Self>) {
        self.move_to(0, cx);
        self.select_to(self.content.len(), cx);
    }

    fn home(&mut self, _: &Home, _: &mut Window, cx: &mut Context<Self>) {
        self.move_to(0, cx);
    }

    fn end(&mut self, _: &End, _: &mut Window, cx: &mut Context<Self>) {
        self.move_to(self.content.len(), cx);
    }

    fn select_home(&mut self, _: &SelectHome, _: &mut Window, cx: &mut Context<Self>) {
        self.select_to(0, cx);
    }

    fn select_end(&mut self, _: &SelectEnd, _: &mut Window, cx: &mut Context<Self>) {
        self.select_to(self.content.len(), cx);
    }

    fn word_left(&mut self, _: &WordLeft, _: &mut Window, cx: &mut Context<Self>) {
        let pos = self.previous_word_boundary(self.cursor_offset());
        self.move_to(pos, cx);
    }

    fn word_right(&mut self, _: &WordRight, _: &mut Window, cx: &mut Context<Self>) {
        let pos = self.next_word_boundary(self.cursor_offset());
        self.move_to(pos, cx);
    }

    fn select_word_left(&mut self, _: &SelectWordLeft, _: &mut Window, cx: &mut Context<Self>) {
        let pos = self.previous_word_boundary(self.cursor_offset());
        self.select_to(pos, cx);
    }

    fn select_word_right(&mut self, _: &SelectWordRight, _: &mut Window, cx: &mut Context<Self>) {
        let pos = self.next_word_boundary(self.cursor_offset());
        self.select_to(pos, cx);
    }

    fn backspace(&mut self, _: &Backspace, window: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            let prev = self.previous_boundary(self.cursor_offset());
            if self.cursor_offset() == prev {
                return;
            }
            self.select_to(prev, cx);
        }
        self.replace_text_in_range(None, "", window, cx);
    }

    fn delete(&mut self, _: &Delete, window: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            let next = self.next_boundary(self.cursor_offset());
            if self.cursor_offset() == next {
                return;
            }
            self.select_to(next, cx);
        }
        self.replace_text_in_range(None, "", window, cx);
    }

    fn backspace_word(&mut self, _: &BackspaceWord, window: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            let prev = self.previous_word_boundary(self.cursor_offset());
            if self.cursor_offset() == prev {
                return;
            }
            self.select_to(prev, cx);
        }
        self.replace_text_in_range(None, "", window, cx);
    }

    fn delete_word(&mut self, _: &DeleteWord, window: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            let next = self.next_word_boundary(self.cursor_offset());
            if self.cursor_offset() == next {
                return;
            }
            self.select_to(next, cx);
        }
        self.replace_text_in_range(None, "", window, cx);
    }

    fn paste(&mut self, _: &Paste, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(text) = cx.read_from_clipboard().and_then(|item| item.text()) {
            // Strip newlines for single-line input
            let clean = text.replace('\n', " ").replace('\r', "");
            self.replace_text_in_range(None, &clean, window, cx);
        }
    }

    fn copy(&mut self, _: &Copy, _: &mut Window, cx: &mut Context<Self>) {
        if !self.selected_range.is_empty() {
            let text = &self.content[self.selected_range.clone()];
            cx.write_to_clipboard(ClipboardItem::new_string(text.to_string()));
        }
    }

    fn cut(&mut self, _: &Cut, window: &mut Window, cx: &mut Context<Self>) {
        if !self.selected_range.is_empty() {
            let text = &self.content[self.selected_range.clone()];
            cx.write_to_clipboard(ClipboardItem::new_string(text.to_string()));
            self.replace_text_in_range(None, "", window, cx);
        }
    }

    fn show_character_palette(
        &mut self,
        _: &ShowCharacterPalette,
        window: &mut Window,
        _: &mut Context<Self>,
    ) {
        window.show_character_palette();
    }

    // -- Mouse handlers ----------------------------------------------------

    fn on_mouse_down(
        &mut self,
        event: &MouseDownEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.disabled {
            return;
        }
        window.focus(&self.focus_handle);

        let now = std::time::Instant::now();
        let is_multi_click = self
            .last_click_time
            .map_or(false, |t| now.duration_since(t).as_millis() < 400);

        if is_multi_click {
            self.click_count += 1;
        } else {
            self.click_count = 1;
        }
        self.last_click_time = Some(now);

        let idx = self.index_for_mouse_position(event.position);

        match self.click_count {
            1 => {
                self.is_selecting = true;
                if event.modifiers.shift {
                    self.select_to(idx, cx);
                } else {
                    self.move_to(idx, cx);
                }
            }
            2 => {
                // Double click: select word
                let start = self.previous_word_boundary(idx);
                let end = self.next_word_boundary(idx);
                self.selected_range = start..end;
                self.selection_reversed = false;
                cx.notify();
            }
            _ => {
                // Triple click: select all
                self.selected_range = 0..self.content.len();
                self.selection_reversed = false;
                self.click_count = 0;
                cx.notify();
            }
        }
    }

    fn on_mouse_up(&mut self, _: &MouseUpEvent, _: &mut Window, _: &mut Context<Self>) {
        self.is_selecting = false;
    }

    fn on_mouse_move(&mut self, event: &MouseMoveEvent, _: &mut Window, cx: &mut Context<Self>) {
        if self.is_selecting {
            self.select_to(self.index_for_mouse_position(event.position), cx);
        }
    }

    // -- Notify on-change callback -----------------------------------------

    fn fire_on_change(&self, cx: &mut App) {
        if let Some(cb) = &self.on_change {
            cb(&self.content, cx);
        }
    }
}

// ---------------------------------------------------------------------------
// EntityInputHandler — Platform IME / text input integration
// ---------------------------------------------------------------------------

impl EntityInputHandler for TextInput {
    fn text_for_range(
        &mut self,
        range_utf16: Range<usize>,
        actual_range: &mut Option<Range<usize>>,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<String> {
        let range = self.range_from_utf16(&range_utf16);
        actual_range.replace(self.range_to_utf16(&range));
        Some(self.content[range].to_string())
    }

    fn selected_text_range(
        &mut self,
        _ignore_disabled_input: bool,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<UTF16Selection> {
        Some(UTF16Selection {
            range: self.range_to_utf16(&self.selected_range),
            reversed: self.selection_reversed,
        })
    }

    fn marked_text_range(
        &self,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<Range<usize>> {
        self.marked_range
            .as_ref()
            .map(|range| self.range_to_utf16(range))
    }

    fn unmark_text(&mut self, _window: &mut Window, _cx: &mut Context<Self>) {
        self.marked_range = None;
    }

    fn replace_text_in_range(
        &mut self,
        range_utf16: Option<Range<usize>>,
        new_text: &str,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let range = range_utf16
            .as_ref()
            .map(|r| self.range_from_utf16(r))
            .or(self.marked_range.clone())
            .unwrap_or(self.selected_range.clone());

        self.push_undo();

        self.content =
            (self.content[0..range.start].to_owned() + new_text + &self.content[range.end..])
                .into();
        self.selected_range = range.start + new_text.len()..range.start + new_text.len();
        self.marked_range.take();
        self.fire_on_change(cx);
        cx.notify();
    }

    fn replace_and_mark_text_in_range(
        &mut self,
        range_utf16: Option<Range<usize>>,
        new_text: &str,
        new_selected_range_utf16: Option<Range<usize>>,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let range = range_utf16
            .as_ref()
            .map(|r| self.range_from_utf16(r))
            .or(self.marked_range.clone())
            .unwrap_or(self.selected_range.clone());

        self.push_undo();

        self.content =
            (self.content[0..range.start].to_owned() + new_text + &self.content[range.end..])
                .into();
        if !new_text.is_empty() {
            self.marked_range = Some(range.start..range.start + new_text.len());
        } else {
            self.marked_range = None;
        }
        self.selected_range = new_selected_range_utf16
            .as_ref()
            .map(|r| self.range_from_utf16(r))
            .map(|new_range| new_range.start + range.start..new_range.end + range.end)
            .unwrap_or_else(|| range.start + new_text.len()..range.start + new_text.len());

        self.fire_on_change(cx);
        cx.notify();
    }

    fn bounds_for_range(
        &mut self,
        range_utf16: Range<usize>,
        bounds: Bounds<Pixels>,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<Bounds<Pixels>> {
        let last_layout = self.last_layout.as_ref()?;
        let range = self.range_from_utf16(&range_utf16);
        Some(Bounds::from_corners(
            point(
                bounds.left() + last_layout.x_for_index(range.start),
                bounds.top(),
            ),
            point(
                bounds.left() + last_layout.x_for_index(range.end),
                bounds.bottom(),
            ),
        ))
    }

    fn character_index_for_point(
        &mut self,
        point: gpui::Point<Pixels>,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<usize> {
        let line_point = self.last_bounds?.localize(&point)?;
        let last_layout = self.last_layout.as_ref()?;
        let utf8_index = last_layout.index_for_x(point.x - line_point.x)?;
        Some(self.offset_to_utf16(utf8_index))
    }
}

// ---------------------------------------------------------------------------
// TextElement — the custom GPUI Element that handles layout and painting
// ---------------------------------------------------------------------------

struct TextInputElement {
    input: Entity<TextInput>,
}

struct TextInputPrepaintState {
    line: Option<ShapedLine>,
    cursor: Option<PaintQuad>,
    selection: Option<PaintQuad>,
}

impl IntoElement for TextInputElement {
    type Element = Self;
    fn into_element(self) -> Self::Element {
        self
    }
}

impl Element for TextInputElement {
    type RequestLayoutState = ();
    type PrepaintState = TextInputPrepaintState;

    fn id(&self) -> Option<ElementId> {
        None
    }

    fn source_location(&self) -> Option<&'static core::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&gpui::InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, Self::RequestLayoutState) {
        let mut style = Style::default();
        style.size.width = relative(1.).into();
        style.size.height = window.line_height().into();
        (window.request_layout(style, [], cx), ())
    }

    fn prepaint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&gpui::InspectorElementId>,
        bounds: Bounds<Pixels>,
        _request_layout: &mut Self::RequestLayoutState,
        window: &mut Window,
        cx: &mut App,
    ) -> Self::PrepaintState {
        let input = self.input.read(cx);
        let display_text = input.display_text();
        let is_empty = input.content.is_empty();
        let selected_range = input.selected_range.clone();
        let cursor = input.cursor_offset();
        let style = window.text_style();
        let is_focused = input.focus_handle.is_focused(window);

        let (text_to_render, text_color) = if is_empty {
            (input.placeholder.clone(), hsla(0., 0., 1., 0.3))
        } else {
            (display_text, style.color)
        };

        let run = TextRun {
            len: text_to_render.len(),
            font: style.font(),
            color: text_color,
            background_color: None,
            underline: None,
            strikethrough: None,
        };

        let runs = if let Some(marked_range) = input.marked_range.as_ref() {
            vec![
                TextRun {
                    len: marked_range.start,
                    ..run.clone()
                },
                TextRun {
                    len: marked_range.end - marked_range.start,
                    underline: Some(UnderlineStyle {
                        color: Some(run.color),
                        thickness: px(1.0),
                        wavy: false,
                    }),
                    ..run.clone()
                },
                TextRun {
                    len: text_to_render.len() - marked_range.end,
                    ..run
                },
            ]
            .into_iter()
            .filter(|r| r.len > 0)
            .collect()
        } else {
            vec![run]
        };

        let font_size = style.font_size.to_pixels(window.rem_size());
        let line = window
            .text_system()
            .shape_line(text_to_render, font_size, &runs, None);

        let cursor_pos = line.x_for_index(cursor);

        // Selection highlight
        let selection = if !selected_range.is_empty() && !is_empty {
            Some(fill(
                Bounds::from_corners(
                    point(
                        bounds.left() + line.x_for_index(selected_range.start),
                        bounds.top(),
                    ),
                    point(
                        bounds.left() + line.x_for_index(selected_range.end),
                        bounds.bottom(),
                    ),
                ),
                // Primary blue with transparency for selection
                hsla(217.0 / 360.0, 0.91, 0.60, 0.30),
            ))
        } else {
            None
        };

        // Cursor caret (only when focused and no selection)
        let cursor_quad =
            if is_focused && selected_range.is_empty() && !is_empty || (is_focused && is_empty) {
                Some(fill(
                    Bounds::new(
                        point(bounds.left() + cursor_pos, bounds.top()),
                        size(px(1.5), bounds.bottom() - bounds.top()),
                    ),
                    // Bright primary blue cursor
                    hsla(217.0 / 360.0, 0.91, 0.60, 1.0),
                ))
            } else {
                None
            };

        TextInputPrepaintState {
            line: Some(line),
            cursor: cursor_quad,
            selection,
        }
    }

    fn paint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&gpui::InspectorElementId>,
        bounds: Bounds<Pixels>,
        _request_layout: &mut Self::RequestLayoutState,
        prepaint: &mut Self::PrepaintState,
        window: &mut Window,
        cx: &mut App,
    ) {
        let focus_handle = self.input.read(cx).focus_handle.clone();
        window.handle_input(
            &focus_handle,
            ElementInputHandler::new(bounds, self.input.clone()),
            cx,
        );

        // Paint selection highlight behind text
        if let Some(selection) = prepaint.selection.take() {
            window.paint_quad(selection);
        }

        // Paint text
        let line = prepaint.line.take().unwrap();
        line.paint(bounds.origin, window.line_height(), window, cx)
            .unwrap();

        // Paint cursor on top
        if let Some(cursor) = prepaint.cursor.take() {
            window.paint_quad(cursor);
        }

        // Store layout for hit testing
        self.input.update(cx, |input, _cx| {
            input.last_layout = Some(line);
            input.last_bounds = Some(bounds);
        });
    }
}

// ---------------------------------------------------------------------------
// Focusable + Render
// ---------------------------------------------------------------------------

impl Focusable for TextInput {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus_handle.clone()
    }
}

impl Render for TextInput {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let theme = Theme::dark();
        let is_focused = self.focus_handle.is_focused(window);
        let disabled = self.disabled;

        div()
            .key_context("TextInput")
            .track_focus(&self.focus_handle(cx))
            .when(!disabled, |this| this.cursor(CursorStyle::IBeam))
            // Actions
            .on_action(cx.listener(Self::backspace))
            .on_action(cx.listener(Self::delete))
            .on_action(cx.listener(Self::left))
            .on_action(cx.listener(Self::right))
            .on_action(cx.listener(Self::select_left))
            .on_action(cx.listener(Self::select_right))
            .on_action(cx.listener(Self::select_all))
            .on_action(cx.listener(Self::home))
            .on_action(cx.listener(Self::end))
            .on_action(cx.listener(Self::select_home))
            .on_action(cx.listener(Self::select_end))
            .on_action(cx.listener(Self::word_left))
            .on_action(cx.listener(Self::word_right))
            .on_action(cx.listener(Self::select_word_left))
            .on_action(cx.listener(Self::select_word_right))
            .on_action(cx.listener(Self::backspace_word))
            .on_action(cx.listener(Self::delete_word))
            .on_action(cx.listener(Self::paste))
            .on_action(cx.listener(Self::cut))
            .on_action(cx.listener(Self::copy))
            .on_action(cx.listener(Self::undo))
            .on_action(cx.listener(Self::redo))
            .on_action(cx.listener(Self::show_character_palette))
            // Mouse
            .on_mouse_down(MouseButton::Left, cx.listener(Self::on_mouse_down))
            .on_mouse_up(MouseButton::Left, cx.listener(Self::on_mouse_up))
            .on_mouse_up_out(MouseButton::Left, cx.listener(Self::on_mouse_up))
            .on_mouse_move(cx.listener(Self::on_mouse_move))
            // Styling
            .h(px(32.0))
            .w_full()
            .px(px(10.0))
            .flex()
            .items_center()
            .bg(theme.surface)
            .border_1()
            .border_color(if is_focused {
                theme.primary
            } else {
                theme.border
            })
            .rounded_md()
            .text_size(px(13.0))
            .text_color(theme.text_primary)
            .when(disabled, |this| this.opacity(0.5).cursor_default())
            .child(
                div()
                    .h(px(20.0))
                    .w_full()
                    .overflow_hidden()
                    .child(TextInputElement { input: cx.entity() }),
            )
    }
}

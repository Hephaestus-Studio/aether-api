//! Toast Notification Component.
//!
//! Provides a non-blocking toast notification stack in the bottom-right corner
//! with auto-dismiss timers, action buttons, and severity levels (Success, Error, Warning, Info).

use crate::theme::Theme;
use crate::views::WorkspaceView;
use gpui::prelude::*;
use gpui::*;
use std::time::Instant;

/// Notification severity level.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToastLevel {
    Success,
    Error,
    Warning,
    Info,
}

/// A single toast notification instance.
#[derive(Debug, Clone)]
pub struct Toast {
    pub id: String,
    pub level: ToastLevel,
    pub title: String,
    pub message: String,
    pub created_at: Instant,
    pub duration_ms: u64,
}

/// State managing the queue and display of toast notifications.
#[derive(Debug, Clone, Default)]
pub struct NotificationState {
    pub toasts: Vec<Toast>,
}

impl NotificationState {
    pub fn new() -> Self {
        Self { toasts: Vec::new() }
    }

    /// Adds a new toast notification.
    pub fn show(
        &mut self,
        level: ToastLevel,
        title: impl Into<String>,
        message: impl Into<String>,
    ) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let toast = Toast {
            id: id.clone(),
            level,
            title: title.into(),
            message: message.into(),
            created_at: Instant::now(),
            duration_ms: match level {
                ToastLevel::Error => 6000,
                _ => 4000,
            },
        };
        // Keep max 5 most recent toasts
        if self.toasts.len() >= 5 {
            self.toasts.remove(0);
        }
        self.toasts.push(toast);
        id
    }

    /// Convenience helpers
    pub fn success(&mut self, title: impl Into<String>, message: impl Into<String>) -> String {
        self.show(ToastLevel::Success, title, message)
    }

    pub fn error(&mut self, title: impl Into<String>, message: impl Into<String>) -> String {
        self.show(ToastLevel::Error, title, message)
    }

    pub fn warning(&mut self, title: impl Into<String>, message: impl Into<String>) -> String {
        self.show(ToastLevel::Warning, title, message)
    }

    pub fn info(&mut self, title: impl Into<String>, message: impl Into<String>) -> String {
        self.show(ToastLevel::Info, title, message)
    }

    /// Dismisses a toast by ID.
    pub fn dismiss(&mut self, id: &str) {
        self.toasts.retain(|t| t.id != id);
    }

    /// Removes expired toasts.
    pub fn cleanup_expired(&mut self) {
        let now = Instant::now();
        self.toasts
            .retain(|t| now.duration_since(t.created_at).as_millis() < t.duration_ms as u128);
    }
}

/// Renders the toast notification overlay in the bottom-right corner.
pub fn render_notifications(
    state: &NotificationState,
    theme: &Theme,
    view: Entity<WorkspaceView>,
) -> impl IntoElement {
    if state.toasts.is_empty() {
        return div().id("notifications-empty");
    }

    let mut container = div()
        .id("notifications-container")
        .absolute()
        .bottom_6()
        .right_6()
        .flex()
        .flex_col_reverse()
        .gap_2()
        .max_w(px(380.0));

    for toast in &state.toasts {
        let toast_id = toast.id.clone();
        let view_dismiss = view.clone();

        let (border_color, bg_accent, icon_char, text_accent) = match toast.level {
            ToastLevel::Success => (
                hsla(142.0 / 360.0, 0.70, 0.45, 0.6),
                hsla(142.0 / 360.0, 0.70, 0.45, 0.12),
                "✓",
                hsla(142.0 / 360.0, 0.75, 0.55, 1.0),
            ),
            ToastLevel::Error => (
                hsla(0.0, 0.70, 0.50, 0.6),
                hsla(0.0, 0.70, 0.50, 0.12),
                "✕",
                hsla(0.0, 0.80, 0.60, 1.0),
            ),
            ToastLevel::Warning => (
                hsla(38.0 / 360.0, 0.80, 0.50, 0.6),
                hsla(38.0 / 360.0, 0.80, 0.50, 0.12),
                "⚠",
                hsla(38.0 / 360.0, 0.90, 0.60, 1.0),
            ),
            ToastLevel::Info => (
                hsla(217.0 / 360.0, 0.80, 0.60, 0.6),
                hsla(217.0 / 360.0, 0.80, 0.60, 0.12),
                "ℹ",
                hsla(217.0 / 360.0, 0.85, 0.65, 1.0),
            ),
        };

        let toast_elem = div()
            .id(ElementId::Name(format!("toast-{}", toast.id).into()))
            .flex()
            .items_start()
            .gap_3()
            .p_3()
            .rounded_md()
            .bg(theme.surface)
            .border_1()
            .border_color(border_color)
            .shadow_lg()
            // Level Icon
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_center()
                    .w(px(22.0))
                    .h(px(22.0))
                    .rounded_full()
                    .bg(bg_accent)
                    .text_color(text_accent)
                    .text_xs()
                    .font_weight(FontWeight::BOLD)
                    .child(icon_char),
            )
            // Text Content
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_1()
                    .gap_0p5()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(FontWeight::BOLD)
                            .text_color(theme.text_primary)
                            .child(toast.title.clone()),
                    )
                    .when(!toast.message.is_empty(), |s| {
                        s.child(
                            div()
                                .text_size(px(11.0))
                                .text_color(theme.text_secondary)
                                .child(toast.message.clone()),
                        )
                    }),
            )
            // Close Button
            .child(
                div()
                    .id(ElementId::Name(format!("toast-close-{}", toast.id).into()))
                    .flex()
                    .items_center()
                    .justify_center()
                    .w(px(16.0))
                    .h(px(16.0))
                    .rounded_sm()
                    .cursor_pointer()
                    .text_color(theme.text_muted)
                    .hover(|s| s.bg(theme.surface_hover).text_color(theme.text_primary))
                    .on_click(move |_, _window, cx| {
                        let id = toast_id.clone();
                        view_dismiss.update(cx, |this, cx| {
                            this.dismiss_toast(&id, cx);
                        });
                    })
                    .child("×"),
            );

        container = container.child(toast_elem);
    }

    container
}

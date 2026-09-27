use aether_ui::{LauncherEvent, LauncherView, Theme, WorkspaceView};
use gpui::prelude::*;
use gpui::*;
use std::path::PathBuf;

struct AetherApp {
    launcher_view: Entity<LauncherView>,
    workspace_view: Option<Entity<WorkspaceView>>,
    is_in_launcher: bool,
    theme: Theme,
}

impl AetherApp {
    fn new(cx: &mut Context<Self>, initial_workspace: Option<PathBuf>) -> Self {
        let theme = Theme::dark();
        let launcher_view = cx.new(|_cx| LauncherView::new());

        let (workspace_view, is_in_launcher) = if let Some(path) = initial_workspace {
            let ws = cx.new(|cx| WorkspaceView::with_workspace(&path, cx));
            (Some(ws), false)
        } else {
            (None, true)
        };

        // Subscribe to launcher open workspace events
        cx.subscribe(
            &launcher_view,
            |this, _launcher, event: &LauncherEvent, cx| match event {
                LauncherEvent::OpenWorkspace(path) => {
                    let path_clone = path.clone();
                    let ws = cx.new(|cx| WorkspaceView::with_workspace(&path_clone, cx));
                    this.workspace_view = Some(ws);
                    this.is_in_launcher = false;
                    cx.notify();
                }
                LauncherEvent::CreateNewProject => {}
                LauncherEvent::CloneRepository => {}
            },
        )
        .detach();

        Self {
            launcher_view,
            workspace_view,
            is_in_launcher,
            theme,
        }
    }

    pub fn return_to_launcher(&mut self, cx: &mut Context<Self>) {
        self.launcher_view.update(cx, |this, _cx| {
            this.reload_recents();
        });
        self.is_in_launcher = true;
        cx.notify();
    }
}

impl Render for AetherApp {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let theme = &self.theme;
        let is_maximized = window.is_maximized();
        let is_in_launcher = self.is_in_launcher;

        div()
            .relative()
            .flex()
            .flex_col()
            .size_full()
            .bg(theme.background)
            .text_color(theme.text_primary)
            .when(!is_maximized, |s| s.border_1().border_color(theme.border))
            // Global Top Header Bar with Window Controls
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .h(px(38.0))
                    .bg(theme.surface)
                    .border_b_1()
                    .border_color(theme.border)
                    // Draggable titlebar area
                    .child(
                        div()
                            .flex()
                            .flex_1()
                            .items_center()
                            .h_full()
                            .px_3()
                            .cursor_default()
                            .on_mouse_down(MouseButton::Left, |event, window, _cx| {
                                if event.click_count == 2 {
                                    window.zoom_window();
                                } else {
                                    window.start_window_move();
                                }
                            })
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_3()
                                    // Aether Logo Icon
                                    .child(
                                        div().flex().items_center().gap_1p5().child(
                                            div()
                                                .text_size(px(14.0))
                                                .text_color(theme.primary)
                                                .child("❄"),
                                        ),
                                    )
                                    // Header MenuBar items (File, Edit, View, Help)
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_0p5()
                                            .on_mouse_down(
                                                MouseButton::Left,
                                                |_event, _window, cx| {
                                                    cx.stop_propagation();
                                                },
                                            )
                                            // File Menu
                                            .child({
                                                let ws_view = self.workspace_view.clone();
                                                div()
                                                    .id("menu-file-btn")
                                                    .px_2()
                                                    .py_1()
                                                    .rounded_sm()
                                                    .text_xs()
                                                    .text_color(theme.text_secondary)
                                                    .cursor_pointer()
                                                    .hover(|s| {
                                                        s.bg(theme.surface_hover)
                                                            .text_color(theme.text_primary)
                                                    })
                                                    .on_click(move |_, _window, cx| {
                                                        if let Some(ws) = &ws_view {
                                                            ws.update(cx, |this, cx| {
                                                                this.open_folder_dialog(cx);
                                                            });
                                                        }
                                                    })
                                                    .child("File")
                                            })
                                            // Edit Menu
                                            .child({
                                                let ws_view = self.workspace_view.clone();
                                                div()
                                                    .id("menu-edit-btn")
                                                    .px_2()
                                                    .py_1()
                                                    .rounded_sm()
                                                    .text_xs()
                                                    .text_color(theme.text_secondary)
                                                    .cursor_pointer()
                                                    .hover(|s| {
                                                        s.bg(theme.surface_hover)
                                                            .text_color(theme.text_primary)
                                                    })
                                                    .on_click(move |_, _window, cx| {
                                                        if let Some(ws) = &ws_view {
                                                            ws.update(cx, |this, cx| {
                                                                this.open_command_palette(cx);
                                                            });
                                                        }
                                                    })
                                                    .child("Edit")
                                            })
                                            // View Menu
                                            .child({
                                                let ws_view = self.workspace_view.clone();
                                                div()
                                                    .id("menu-view-btn")
                                                    .px_2()
                                                    .py_1()
                                                    .rounded_sm()
                                                    .text_xs()
                                                    .text_color(theme.text_secondary)
                                                    .cursor_pointer()
                                                    .hover(|s| {
                                                        s.bg(theme.surface_hover)
                                                            .text_color(theme.text_primary)
                                                    })
                                                    .on_click(move |_, _window, cx| {
                                                        if let Some(ws) = &ws_view {
                                                            ws.update(cx, |this, cx| {
                                                                this.toggle_terminal(cx);
                                                            });
                                                        }
                                                    })
                                                    .child("View")
                                            })
                                            // Help Menu
                                            .child({
                                                div()
                                                    .id("menu-help-btn")
                                                    .px_2()
                                                    .py_1()
                                                    .rounded_sm()
                                                    .text_xs()
                                                    .text_color(theme.text_secondary)
                                                    .cursor_pointer()
                                                    .hover(|s| {
                                                        s.bg(theme.surface_hover)
                                                            .text_color(theme.text_primary)
                                                    })
                                                    .child("Help")
                                            })
                                            // Switch Workspace (when inside workspace)
                                            .when(!is_in_launcher, |this| {
                                                this.child(
                                                    div()
                                                        .id("menu-switch-ws-btn")
                                                        .px_2()
                                                        .py_1()
                                                        .rounded_sm()
                                                        .text_xs()
                                                        .text_color(theme.text_muted)
                                                        .cursor_pointer()
                                                        .hover(|s| {
                                                            s.bg(theme.surface_hover)
                                                                .text_color(theme.text_primary)
                                                        })
                                                        .on_click(cx.listener(|this, _, _, cx| {
                                                            this.return_to_launcher(cx);
                                                        }))
                                                        .child("Switch Workspace"),
                                                )
                                            }),
                                    ),
                            ),
                    )
                    // Right-side Environment selector and window controls
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .px_3()
                            .on_mouse_down(MouseButton::Left, |_event, _window, cx| {
                                cx.stop_propagation();
                            })
                            // Global Environment Selector Pill: [ 🌐 Global ⌄ ]
                            .child({
                                let ws_view = self.workspace_view.clone();
                                div()
                                    .id("env-selector-pill")
                                    .flex()
                                    .items_center()
                                    .gap_1p5()
                                    .h(px(26.0))
                                    .px_2p5()
                                    .rounded_md()
                                    .bg(theme.surface_hover)
                                    .border_1()
                                    .border_color(theme.border)
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(theme.border).text_color(theme.text_primary))
                                    .on_click(move |_, _window, cx| {
                                        if let Some(ws) = &ws_view {
                                            ws.update(cx, |this, cx| {
                                                this.open_command_palette(cx);
                                            });
                                        }
                                    })
                                    .child(
                                        div()
                                            .text_size(px(11.0))
                                            .text_color(theme.primary)
                                            .child("🌐"),
                                    )
                                    .child(
                                        div()
                                            .font_weight(FontWeight::MEDIUM)
                                            .text_color(theme.text_primary)
                                            .child("Global"),
                                    )
                                    .child(
                                        div()
                                            .text_size(px(9.0))
                                            .text_color(theme.text_muted)
                                            .child("⌄"),
                                    )
                            })
                            // Layout buttons
                            .child(
                                div()
                                    .id("win_layout_btn")
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .w(px(24.0))
                                    .h(px(24.0))
                                    .rounded_sm()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(theme.surface_hover))
                                    .text_size(px(11.0))
                                    .text_color(theme.text_muted)
                                    .child("◫"),
                            )
                            // Minimize Button
                            .child(
                                div()
                                    .id("win_minimize")
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .w(px(26.0))
                                    .h(px(26.0))
                                    .rounded_sm()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(theme.surface_hover))
                                    .text_size(px(13.0))
                                    .text_color(theme.text_secondary)
                                    .child("—")
                                    .on_click(|_event, window, _cx| {
                                        window.minimize_window();
                                    }),
                            )
                            // Maximize / Restore Button
                            .child(
                                div()
                                    .id("win_maximize")
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .w(px(26.0))
                                    .h(px(26.0))
                                    .rounded_sm()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(theme.surface_hover))
                                    .text_size(px(13.0))
                                    .text_color(theme.text_secondary)
                                    .child(if is_maximized { "❐" } else { "□" })
                                    .on_click(|_event, window, _cx| {
                                        window.zoom_window();
                                    }),
                            )
                            // Close Button
                            .child(
                                div()
                                    .id("win_close")
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .w(px(26.0))
                                    .h(px(26.0))
                                    .rounded_sm()
                                    .cursor_pointer()
                                    .hover(|s| {
                                        s.bg(gpui::hsla(0.0, 0.85, 0.55, 1.0))
                                            .text_color(gpui::hsla(0.0, 0.0, 1.0, 1.0))
                                    })
                                    .text_size(px(13.0))
                                    .text_color(theme.text_secondary)
                                    .child("✕")
                                    .on_click(|_event, window, cx| {
                                        window.remove_window();
                                        cx.quit();
                                    }),
                            ),
                    ),
            )
            // Main Body: Either Launcher View or Workspace View
            .child(
                div()
                    .flex()
                    .flex_1()
                    .overflow_hidden()
                    .when(is_in_launcher, |this| {
                        this.child(self.launcher_view.clone())
                    })
                    .when(!is_in_launcher, |this| {
                        if let Some(ws) = &self.workspace_view {
                            this.child(ws.clone())
                        } else {
                            this.child(self.launcher_view.clone())
                        }
                    }),
            )
            // Global Status Bar (when in workspace view)
            .when(!is_in_launcher, |this| {
                let ws_view = self.workspace_view.clone();
                let ws_term = self.workspace_view.clone();
                this.child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .h(px(24.0))
                        .px_3()
                        .bg(theme.surface)
                        .border_t_1()
                        .border_color(theme.border)
                        .text_size(px(11.0))
                        .text_color(theme.text_muted)
                        // Left: >_ Terminal | 🌐 Environments | Ready
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_3()
                                // Terminal Toggle
                                .child(
                                    div()
                                        .id("status-term-btn")
                                        .flex()
                                        .items_center()
                                        .gap_1()
                                        .cursor_pointer()
                                        .hover(|s| s.text_color(theme.text_primary))
                                        .on_click(move |_, _w, cx| {
                                            if let Some(ws) = &ws_term {
                                                ws.update(cx, |this, cx| {
                                                    this.toggle_terminal(cx);
                                                });
                                            }
                                        })
                                        .child(">_ Terminal"),
                                )
                                // Environments
                                .child(
                                    div()
                                        .id("status-env-btn")
                                        .flex()
                                        .items_center()
                                        .gap_1()
                                        .cursor_pointer()
                                        .hover(|s| s.text_color(theme.text_primary))
                                        .on_click(move |_, _w, cx| {
                                            if let Some(ws) = &ws_view {
                                                ws.update(cx, |this, cx| {
                                                    this.open_vault_dialog(cx);
                                                });
                                            }
                                        })
                                        .child("🌐 Environments"),
                                )
                                // Ready Status
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_1()
                                        .text_color(theme.text_muted)
                                        .child("Ready"),
                                ),
                        )
                        // Right: Local-First badge
                        .child(
                            div()
                                .text_size(px(10.0))
                                .text_color(theme.text_muted)
                                .child("Local-First & Git-Centric"),
                        ),
                )
            })
            // Window Resize Borders (Active when not maximized)
            .when(!is_maximized, |s| {
                s.child(
                    // Top Edge
                    div()
                        .absolute()
                        .top_0()
                        .left_2()
                        .right_2()
                        .h(px(4.0))
                        .cursor_row_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::Top);
                        }),
                )
                .child(
                    // Bottom Edge
                    div()
                        .absolute()
                        .bottom_0()
                        .left_2()
                        .right_2()
                        .h(px(4.0))
                        .cursor_row_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::Bottom);
                        }),
                )
                .child(
                    // Left Edge
                    div()
                        .absolute()
                        .top_2()
                        .bottom_2()
                        .left_0()
                        .w(px(4.0))
                        .cursor_col_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::Left);
                        }),
                )
                .child(
                    // Right Edge
                    div()
                        .absolute()
                        .top_2()
                        .bottom_2()
                        .right_0()
                        .w(px(4.0))
                        .cursor_col_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::Right);
                        }),
                )
                .child(
                    // Top-Left Corner
                    div()
                        .absolute()
                        .top_0()
                        .left_0()
                        .size(px(8.0))
                        .cursor_nwse_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::TopLeft);
                        }),
                )
                .child(
                    // Top-Right Corner
                    div()
                        .absolute()
                        .top_0()
                        .right_0()
                        .size(px(8.0))
                        .cursor_nesw_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::TopRight);
                        }),
                )
                .child(
                    // Bottom-Left Corner
                    div()
                        .absolute()
                        .bottom_0()
                        .left_0()
                        .size(px(8.0))
                        .cursor_nesw_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::BottomLeft);
                        }),
                )
                .child(
                    // Bottom-Right Corner
                    div()
                        .absolute()
                        .bottom_0()
                        .right_0()
                        .size(px(8.0))
                        .cursor_nwse_resize()
                        .on_mouse_down(MouseButton::Left, |_event, window, _cx| {
                            window.start_window_resize(gpui::ResizeEdge::BottomRight);
                        }),
                )
            })
    }
}

fn print_help() {
    println!(
        r#"Aether API - Fast, Local-First, and Git-Centric API Development Client

USAGE:
    aether-app [OPTIONS] [WORKSPACE_PATH]

ARGS:
    <WORKSPACE_PATH>    Path to open as initial workspace collection directory

OPTIONS:
    -h, --help          Print help information
    -v, --version       Print version information
    -w, --workspace     Specify workspace path explicitly

KEYBINDINGS:
    Ctrl + P            Quick Open / Fuzzy file search
    Ctrl + K            Command Palette
    Ctrl + Shift + T    New Request Tab
    Ctrl + W            Close active tab
    Ctrl + S            Save current request
    Ctrl + Enter        Send active HTTP request
    Ctrl + ` (Backtick) Toggle embedded terminal panel
"#
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let mut initial_path: Option<PathBuf> = None;
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "-h" | "--help" => {
                print_help();
                return;
            }
            "-v" | "--version" => {
                println!("Aether API v{}", env!("CARGO_PKG_VERSION"));
                return;
            }
            "-w" | "--workspace" => {
                if i + 1 < args.len() {
                    initial_path = Some(PathBuf::from(&args[i + 1]));
                    i += 1;
                }
            }
            arg if !arg.starts_with('-') => {
                initial_path = Some(PathBuf::from(arg));
            }
            _ => {}
        }
        i += 1;
    }

    tracing_subscriber::fmt::init();

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to initialize Tokio runtime");
    let _runtime_guard = runtime.enter();

    Application::new().run(move |cx: &mut App| {
        aether_ui::bind_text_input_keys(cx);
        aether_ui::bind_text_area_keys(cx);
        let bounds = Bounds::centered(None, size(px(1240.0), px(780.0)), cx);
        let path = initial_path.clone();

        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                titlebar: None,
                window_decorations: Some(gpui::WindowDecorations::Server),
                ..Default::default()
            },
            |_window, cx| cx.new(|cx| AetherApp::new(cx, path)),
        )
        .unwrap();
    });
}

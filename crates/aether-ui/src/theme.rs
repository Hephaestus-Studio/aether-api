use gpui::Hsla;

#[derive(Debug, Clone)]
pub struct Theme {
    pub is_dark: bool,
    pub background: Hsla,
    pub surface: Hsla,
    pub surface_hover: Hsla,
    pub border: Hsla,
    pub text_primary: Hsla,
    pub text_secondary: Hsla,
    pub text_muted: Hsla,
    pub primary: Hsla,
    pub primary_hover: Hsla,
    pub error: Hsla,
    pub success: Hsla,
    pub warning: Hsla,

    // HTTP Method Colors
    pub method_get: Hsla,
    pub method_post: Hsla,
    pub method_put: Hsla,
    pub method_delete: Hsla,
    pub method_patch: Hsla,
    pub method_options: Hsla,
    pub method_head: Hsla,
}

impl Default for Theme {
    fn default() -> Self {
        Self::dark()
    }
}

impl Theme {
    pub fn dark() -> Self {
        Self {
            is_dark: true,
            background: gpui::hsla(220.0 / 360.0, 0.15, 0.07, 1.0), // Deep background #101216
            surface: gpui::hsla(220.0 / 360.0, 0.13, 0.11, 1.0),    // Sidebar/Pill surface #17191e
            surface_hover: gpui::hsla(220.0 / 360.0, 0.13, 0.16, 1.0),
            border: gpui::hsla(220.0 / 360.0, 0.13, 0.20, 1.0), // Subtle divider #252830
            text_primary: gpui::hsla(0.0, 0.0, 0.95, 1.0),
            text_secondary: gpui::hsla(220.0 / 360.0, 0.10, 0.65, 1.0),
            text_muted: gpui::hsla(220.0 / 360.0, 0.10, 0.45, 1.0),
            primary: gpui::hsla(208.0 / 360.0, 0.95, 0.48, 1.0), // Electric Send Blue #0284c7
            primary_hover: gpui::hsla(208.0 / 360.0, 0.95, 0.40, 1.0),
            error: gpui::hsla(0.0 / 360.0, 0.84, 0.60, 1.0), // Coral Red
            success: gpui::hsla(145.0 / 360.0, 0.75, 0.45, 1.0), // Emerald Green
            warning: gpui::hsla(38.0 / 360.0, 0.95, 0.50, 1.0), // Amber

            method_get: gpui::hsla(145.0 / 360.0, 0.75, 0.45, 1.0), // Emerald Green #10b981
            method_post: gpui::hsla(38.0 / 360.0, 0.95, 0.50, 1.0), // Amber / Golden Orange #f59e0b
            method_put: gpui::hsla(217.0 / 360.0, 0.91, 0.60, 1.0), // Sky Blue
            method_delete: gpui::hsla(0.0 / 360.0, 0.84, 0.60, 1.0), // Coral Red
            method_patch: gpui::hsla(173.0 / 360.0, 0.80, 0.42, 1.0), // Teal
            method_options: gpui::hsla(280.0 / 360.0, 0.65, 0.60, 1.0), // Purple
            method_head: gpui::hsla(200.0 / 360.0, 0.80, 0.55, 1.0), // Cyan
        }
    }

    pub fn light() -> Self {
        Self {
            is_dark: false,
            background: gpui::hsla(0.0, 0.0, 0.98, 1.0),
            surface: gpui::hsla(0.0, 0.0, 1.0, 1.0),
            surface_hover: gpui::hsla(220.0 / 360.0, 0.10, 0.94, 1.0),
            border: gpui::hsla(220.0 / 360.0, 0.10, 0.85, 1.0),
            text_primary: gpui::hsla(220.0 / 360.0, 0.20, 0.15, 1.0),
            text_secondary: gpui::hsla(220.0 / 360.0, 0.10, 0.40, 1.0),
            text_muted: gpui::hsla(220.0 / 360.0, 0.10, 0.60, 1.0),
            primary: gpui::hsla(208.0 / 360.0, 0.95, 0.45, 1.0),
            primary_hover: gpui::hsla(208.0 / 360.0, 0.95, 0.38, 1.0),
            error: gpui::hsla(0.0 / 360.0, 0.84, 0.50, 1.0),
            success: gpui::hsla(145.0 / 360.0, 0.75, 0.38, 1.0),
            warning: gpui::hsla(38.0 / 360.0, 0.95, 0.42, 1.0),

            method_get: gpui::hsla(145.0 / 360.0, 0.75, 0.38, 1.0),
            method_post: gpui::hsla(38.0 / 360.0, 0.95, 0.42, 1.0),
            method_put: gpui::hsla(217.0 / 360.0, 0.91, 0.50, 1.0),
            method_delete: gpui::hsla(0.0 / 360.0, 0.84, 0.50, 1.0),
            method_patch: gpui::hsla(173.0 / 360.0, 0.80, 0.35, 1.0),
            method_options: gpui::hsla(280.0 / 360.0, 0.65, 0.50, 1.0),
            method_head: gpui::hsla(200.0 / 360.0, 0.80, 0.45, 1.0),
        }
    }

    pub fn dracula() -> Self {
        Self {
            is_dark: true,
            background: gpui::hsla(231.0 / 360.0, 0.15, 0.14, 1.0), // #282a36
            surface: gpui::hsla(232.0 / 360.0, 0.14, 0.18, 1.0),    // #44475a
            surface_hover: gpui::hsla(232.0 / 360.0, 0.14, 0.24, 1.0),
            border: gpui::hsla(232.0 / 360.0, 0.14, 0.30, 1.0),
            text_primary: gpui::hsla(60.0 / 360.0, 0.30, 0.96, 1.0), // #f8f8f2
            text_secondary: gpui::hsla(230.0 / 360.0, 0.15, 0.70, 1.0),
            text_muted: gpui::hsla(230.0 / 360.0, 0.15, 0.50, 1.0),
            primary: gpui::hsla(326.0 / 360.0, 1.0, 0.74, 1.0), // #ff79c6 pink
            primary_hover: gpui::hsla(326.0 / 360.0, 1.0, 0.65, 1.0),
            error: gpui::hsla(0.0 / 360.0, 1.0, 0.67, 1.0), // #ff5555
            success: gpui::hsla(135.0 / 360.0, 0.94, 0.65, 1.0), // #50fa7b
            warning: gpui::hsla(65.0 / 360.0, 0.92, 0.76, 1.0), // #f1fa8c

            method_get: gpui::hsla(135.0 / 360.0, 0.94, 0.65, 1.0),
            method_post: gpui::hsla(31.0 / 360.0, 1.0, 0.71, 1.0), // #ffb86c orange
            method_put: gpui::hsla(191.0 / 360.0, 0.97, 0.77, 1.0), // #8be9fd cyan
            method_delete: gpui::hsla(0.0 / 360.0, 1.0, 0.67, 1.0),
            method_patch: gpui::hsla(265.0 / 360.0, 0.89, 0.78, 1.0), // #bd93f9 purple
            method_options: gpui::hsla(326.0 / 360.0, 1.0, 0.74, 1.0),
            method_head: gpui::hsla(191.0 / 360.0, 0.97, 0.77, 1.0),
        }
    }

    pub fn nord() -> Self {
        Self {
            is_dark: true,
            background: gpui::hsla(220.0 / 360.0, 0.16, 0.18, 1.0), // #2e3440 (nord0)
            surface: gpui::hsla(222.0 / 360.0, 0.16, 0.23, 1.0),    // #3b4252 (nord1)
            surface_hover: gpui::hsla(220.0 / 360.0, 0.17, 0.28, 1.0),
            border: gpui::hsla(220.0 / 360.0, 0.16, 0.36, 1.0), // #4c566a (nord3)
            text_primary: gpui::hsla(218.0 / 360.0, 0.27, 0.94, 1.0), // #eceff4 (nord6)
            text_secondary: gpui::hsla(219.0 / 360.0, 0.28, 0.88, 1.0),
            text_muted: gpui::hsla(220.0 / 360.0, 0.16, 0.60, 1.0),
            primary: gpui::hsla(193.0 / 360.0, 0.43, 0.67, 1.0), // #88c0d0 (nord8)
            primary_hover: gpui::hsla(193.0 / 360.0, 0.43, 0.58, 1.0),
            error: gpui::hsla(354.0 / 360.0, 0.42, 0.56, 1.0), // #bf616a (nord11)
            success: gpui::hsla(92.0 / 360.0, 0.28, 0.65, 1.0), // #a3be8c (nord14)
            warning: gpui::hsla(40.0 / 360.0, 0.71, 0.73, 1.0), // #ebcb8b (nord13)

            method_get: gpui::hsla(92.0 / 360.0, 0.28, 0.65, 1.0),
            method_post: gpui::hsla(40.0 / 360.0, 0.71, 0.73, 1.0),
            method_put: gpui::hsla(193.0 / 360.0, 0.43, 0.67, 1.0),
            method_delete: gpui::hsla(354.0 / 360.0, 0.42, 0.56, 1.0),
            method_patch: gpui::hsla(311.0 / 360.0, 0.20, 0.63, 1.0), // #b48ead (nord15)
            method_options: gpui::hsla(213.0 / 360.0, 0.32, 0.52, 1.0), // #5e81ac (nord10)
            method_head: gpui::hsla(179.0 / 360.0, 0.25, 0.65, 1.0),  // #8fbcbb (nord7)
        }
    }
}

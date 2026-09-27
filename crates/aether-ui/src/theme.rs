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
            border: gpui::hsla(220.0 / 360.0, 0.13, 0.20, 1.0),     // Subtle divider #252830
            text_primary: gpui::hsla(0.0, 0.0, 0.95, 1.0),
            text_secondary: gpui::hsla(220.0 / 360.0, 0.10, 0.65, 1.0),
            text_muted: gpui::hsla(220.0 / 360.0, 0.10, 0.45, 1.0),
            primary: gpui::hsla(208.0 / 360.0, 0.95, 0.48, 1.0),    // Electric Send Blue #0284c7
            primary_hover: gpui::hsla(208.0 / 360.0, 0.95, 0.40, 1.0),

            method_get: gpui::hsla(145.0 / 360.0, 0.75, 0.45, 1.0), // Emerald Green #10b981
            method_post: gpui::hsla(38.0 / 360.0, 0.95, 0.50, 1.0),  // Amber / Golden Orange #f59e0b
            method_put: gpui::hsla(217.0 / 360.0, 0.91, 0.60, 1.0),  // Sky Blue
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

            method_get: gpui::hsla(145.0 / 360.0, 0.75, 0.38, 1.0),
            method_post: gpui::hsla(38.0 / 360.0, 0.95, 0.42, 1.0),
            method_put: gpui::hsla(217.0 / 360.0, 0.91, 0.50, 1.0),
            method_delete: gpui::hsla(0.0 / 360.0, 0.84, 0.50, 1.0),
            method_patch: gpui::hsla(173.0 / 360.0, 0.80, 0.35, 1.0),
            method_options: gpui::hsla(280.0 / 360.0, 0.65, 0.50, 1.0),
            method_head: gpui::hsla(200.0 / 360.0, 0.80, 0.45, 1.0),
        }
    }
}

<div align="center">

<img src="assets/banner.svg" alt="Aether API Banner" width="720" style="max-width: 100%; height: auto;" />

<br/>
<br/>

**Your APIs. Your Files. Your Control.**  
_The next-generation open-source API client: **Local-first**, **Git-centric**, ultra-lightweight, and privacy-focused._

<br/>

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-reqwest-dea584.svg)](https://www.rust-lang.org/)
[![Local First](https://img.shields.io/badge/Privacy-100%25%20Local--First-brightgreen.svg)](#privacy-manifesto)

</div>

---

## Overview

**Aether API** is an open-source, local-first, and Git-centric API development client built to eliminate cloud dependency, vendor lock-in, telemetry tracking, and bloated memory usage common in traditional API tools.

All collections, folders, requests, and environments are saved directly as **human-readable YAML files on your disk**. This allows you to manage API workspaces with **Git**—branching, code reviews, pull requests, and offline team collaboration without mandatory accounts or third-party servers.

---

## Key Features

### 1. File-System & Git-Centric Workspaces

- Workspaces are standard local directories on your computer.
- Every change is saved directly into clean `.yml` files, ready for `git commit`, `git merge`, and `git diff`.
- Built-in real-time File System Watcher automatically synchronizes external disk modifications.

### 2. Powerful & Accurate Request Execution

- **Comprehensive HTTP Methods**: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- **Query Parameters & Headers Editor**: Intuitive key-value table with bulk edits and individual toggle switches.
- **Authentication**: Native support for Bearer Token, Basic Auth, and API Key (Header / Query).
- **Rich Body Formats**: `JSON` (powered by Monaco Editor with syntax highlighting & auto-format), `Text`, `XML`, `Form URL-Encoded`, `Multipart Form Data` (file uploads), and `Binary`.
- **Advanced Response Viewer**:
  - View modes: **Pretty**, **Raw**, and **Preview**.
  - Detailed response metrics: Status Code, Response Timeline, Latency (ms), Download Size, and Response Headers.
  - One-click response export (`Download Response`).

### 3. Smart Environments & Autocomplete

- Universal variable substitution syntax: `{{variable_name}}` in URLs, Headers, Query Params, Auth, and Request Bodies.
- **Trigger Autocomplete** simply by typing `{{` with keyboard navigation (`↑`, `↓`, `Enter`).
- **Secret Masking & Tooltip Details**: Sensitive values (API keys, passwords, tokens) are masked as `••••••••` with quick reveal toggle and tooltip showing variable origin (_Global_ vs _Environment_).
- **On-Device Cryptography (AES-256-GCM)**: Secret environment variables are encrypted using master key passphrases with AES-256-GCM + PBKDF2; sensitive secrets are never saved in plain text.

### 4. Embedded Multi-Tab Terminal

- Integrated pseudo-terminal (PTY) built with Rust and xterm.js.
- Open multiple independent terminal tabs to run `git`, `curl`, `npm`, `cargo`, and local scripts directly in your workspace directory.

### 5. Instant Code Snippet Generator

- Convert any HTTP request into production-ready code with a single click:
  - **cURL**, **HTTPie**, **Wget**
  - **JavaScript / TypeScript (Fetch API)**
  - **Python (Requests)**
  - **Rust (Reqwest)**
  - **Go (net/http)**
  - **Java (OkHttp)**

### 6. Power Tools & Keyboard Navigation

- **Quick Open (`Ctrl+P`)**: Fuzzy find and jump to any request or folder in the workspace.
- **Search Open Tabs (`Ctrl+Shift+A`)**: Instantly search open tabs with HTTP method badges and dirty indicators `●`.
- **Command Palette (`Ctrl+K` / `Ctrl+Shift+P`)**: Access all application actions from one central menu.
- **Horizontal Tab Scrolling**: Smooth mouse wheel scroll support across open request tabs.

---

## Privacy Manifesto

- **100% Local-First & Zero Telemetry**: Aether API does not track, collect, or send your API keys, payloads, or responses to any external analytics server.
- **Complete Data Ownership**: Your data stays exclusively on your machine and in your own Git repositories.
- **No Vendor Lock-in**: Full freedom to backup, sync, and share through Git, Google Drive, Dropbox, or any self-hosted solution.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Core Shell & Backend** | [Tauri v2](https://v2.tauri.app/) (Rust 2021) |
| **HTTP Engine** | [Reqwest](https://github.com/seanmonstar/reqwest) + [Tokio](https://tokio.rs/) |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| **UI Components & Icons** | [Mantine v7](https://mantine.dev/) + [Tabler Icons](https://tabler.io/icons) |
| **Code Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| **Terminal Engine** | [xterm.js](https://xtermjs.org/) + Portable PTY |
| **Cryptography** | AES-256-GCM + PBKDF2 (Rust `aes-gcm` crate) |

---

## Getting Started

### Prerequisites

1. **Node.js**: Version 18.x or higher.
2. **pnpm**: Package manager (`npm install -g pnpm`).
3. **Rust Toolchain**: `cargo` and `rustc` installed via [rustup.rs](https://rustup.rs/).
4. **Linux System Dependencies** (Debian / Ubuntu):

   ```bash
   sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
   ```

### Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/Hephaestus-Studio/aether-api.git
cd aether-api

# 2. Install dependencies
pnpm install

# 3. Launch application in development mode (with hot reload)
pnpm tauri dev
```

### Production Build

```bash
# Compile binary and package installer (AppImage, deb, dmg, msi, exe based on OS)
pnpm tauri build
```

---

## Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| **`Ctrl + Enter`** | Send current request |
| **`Ctrl + S`** | Save current request |
| **`Ctrl + W`** | Close current tab (with unsaved changes prompt) |
| **`Ctrl + Shift + A`** | Quick search open tabs |
| **`Ctrl + P`** | Quick Open request / file in workspace |
| **`Ctrl + K`** / **`Ctrl + Shift + P`** | Open Command Palette |
| **`Ctrl + \``** | Toggle Terminal Panel |
| **`Ctrl + O`** | Open a new workspace folder |

---

## Contributing

Contributions from the community are warmly welcomed!

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a **Pull Request**.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ by <strong>Hephaestus Studio</strong>.</sub>
</div>

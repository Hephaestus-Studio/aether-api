import { DocArticle, DocCategory } from "./types";

export const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "getting-started",
    title: {
      en: "Getting Started",
      vi: "Bắt đầu nhanh",
    },
    icon: "rocket",
    articleIds: ["overview", "installation", "first-request"],
  },
  {
    id: "git-architecture",
    title: {
      en: "Git-Native Architecture",
      vi: "Kiến trúc Chuẩn Git",
    },
    icon: "git",
    articleIds: ["yaml-schema", "git-workflow", "merge-conflicts"],
  },
  {
    id: "security",
    title: {
      en: "Security & Secret Vault",
      vi: "Bảo mật & Két Mã hóa",
    },
    icon: "shield",
    articleIds: ["crypto-model", "master-key", "secret-masking"],
  },
  {
    id: "scripting",
    title: {
      en: "Scripting & Testing",
      vi: "Scripting & Kiểm thử",
    },
    icon: "code",
    articleIds: ["scripting-basics", "pre-post-hooks", "test-assertions"],
  },
  {
    id: "productivity",
    title: {
      en: "Productivity & Tools",
      vi: "Hiệu suất & Công cụ",
    },
    icon: "terminal",
    articleIds: ["embedded-terminal", "shortcuts", "code-generators"],
  },
  {
    id: "migration",
    title: {
      en: "Migration Guides",
      vi: "Hướng dẫn Chuyển đổi",
    },
    icon: "import",
    articleIds: ["from-postman", "from-insomnia-openapi"],
  },
];

export const DOC_ARTICLES: Record<string, DocArticle> = {
  overview: {
    id: "overview",
    category: "getting-started",
    readTime: "3 min",
    tags: ["intro", "philosophy", "local-first", "git"],
    title: {
      en: "Introduction to Aether API",
      vi: "Giới thiệu về Aether API",
    },
    description: {
      en: "Learn about Aether API, the modern local-first, zero-telemetry, and Git-centric API development client.",
      vi: "Tìm hiểu về Aether API, công cụ phát triển API cục bộ, chuẩn Git và không thu thập dữ liệu người dùng.",
    },
    headings: {
      en: [
        { id: "what-is-aether", text: "What is Aether API?", level: 2 },
        { id: "core-pillars", text: "Core Architectural Pillars", level: 2 },
        { id: "why-not-cloud", text: "Why Choose Git over Proprietary Cloud?", level: 2 },
        { id: "system-requirements", text: "System Requirements", level: 2 },
      ],
      vi: [
        { id: "what-is-aether", text: "Aether API là gì?", level: 2 },
        { id: "core-pillars", text: "Các trụ cột kiến trúc cốt lõi", level: 2 },
        { id: "why-not-cloud", text: "Tại sao chọn Git thay vì Cloud độc quyền?", level: 2 },
        { id: "system-requirements", text: "Yêu cầu hệ thống", level: 2 },
      ],
    },
    content: {
      en: `
## What is Aether API?

**Aether API** is a next-generation API client engineered from the ground up for software developers who value speed, privacy, and seamless team collaboration.

Unlike traditional API clients that lock your collections into proprietary cloud backends and enforce user accounts, Aether API is **100% Local-First** and **Git-Centric**. Your workspaces are real directories on your physical disk, and all collections, requests, and environments are saved as clean, human-readable YAML files.

> [!TIP]
> Everything in Aether API lives inside your Git repository. You collaborate with your team using the tools you already know and trust: **Git branches, Pull Requests, Code Reviews, and Commit histories**.

---

## Core Architectural Pillars

1. **⚡ Tauri v2 + Rust Reqwest Engine**: Sub-80MB RAM footprint, instant cold-starts (<300ms), and true native execution without heavy Electron overhead.
2. **🔒 Zero Telemetry & On-Device Cryptography**: No analytics tracking, no server logins, and master-key AES-256-GCM encrypted secret vaults.
3. **📁 Git-Native File Formats**: Collections and requests are structured as standard YAML files, completely transparent and diff-friendly.
4. **💻 Integrated Multi-Tab Terminal**: Native pseudoterminal (PTY) powered by Rust and xterm.js so you never have to leave your workspace to run dev servers, git commands, or curl scripts.

---

## Why Choose Git over Proprietary Cloud?

| Capability | Traditional Cloud Clients | Aether API (Git-Centric) |
| :--- | :--- | :--- |
| **Storage** | Proprietary cloud database | Plain YAML files on disk & Git |
| **Collaboration** | Paywalled team workspaces | Standard Git PRs & Branch merges |
| **Offline Support** | Degraded or blocked | 100% fully functional offline |
| **Secret Management** | Secrets uploaded to third-party | AES-256-GCM encrypted locally |
| **Telemetry** | Constant usage & payload tracking | Zero telemetry, zero tracking |
| **Resource Usage** | 800MB–2GB RAM (Electron) | <80MB RAM (Tauri + Rust) |

---

## System Requirements

- **Operating System**: Linux (x86_64, aarch64), Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch Linux.
- **Memory**: 256MB RAM minimum (512MB recommended).
- **Disk Space**: ~120MB for binary installation.
- **Optional**: Git 2.25+ installed for Git workspace features.
`,
      vi: `
## Aether API là gì?

**Aether API** là công cụ phát triển và kiểm thử API thế hệ mới được thiết kế đặc biệt dành cho các kỹ sư phần mềm coi trọng tốc độ, quyền riêng tư và khả năng cộng tác nhóm mượt mà.

Khác với các ứng dụng truyền thống lưu dữ liệu trên máy chủ đám mây độc quyền và ép buộc đăng nhập, Aether API hoạt động theo triết lý **Cục bộ 100% (Local-First)** và **Chuẩn Git (Git-Centric)**. Không gian làm việc (Workspace) là các thư mục thực tế trên ổ đĩa của bạn, toàn bộ request, collection và biến môi trường được lưu thành các tệp YAML thuần túy.

> [!TIP]
> Mọi dữ liệu trong Aether API đều nằm trực tiếp trong kho mã nguồn Git của bạn. Bạn cộng tác với đồng đội thông qua quy trình quen thuộc: **Tạo nhánh (Branch), Gửi Pull Request, Duyệt mã (Code Review) và Commit history**.

---

## Các trụ cột kiến trúc cốt lõi

1. **⚡ Nền tảng Tauri v2 + Rust Reqwest Engine**: Tiêu tốn dưới 80MB RAM, khởi động tức thì (<300ms) và loại bỏ hoàn toàn sự nặng nề của Electron.
2. **🔒 Không Telemetry & Mã hóa Cục bộ**: Không gửi dữ liệu người dùng, không bắt đăng nhập, mã hóa bí mật nhạy cảm bằng chuẩn AES-256-GCM.
3. **📁 Định dạng Chuẩn Git**: Request và collection được lưu dưới dạng file YAML dễ đọc, tối ưu cho việc so sánh Git diff.
4. **💻 Terminal PTY Đa Tab Tích hợp**: Terminal PTY nguyên bản sử dụng xterm.js và backend Rust giúp chạy dev server, lệnh git hoặc curl trực tiếp trong ứng dụng.

---

## Tại sao chọn Git thay vì Cloud độc quyền?

| Tính năng | Client Đám Mây Truyền Thống | Aether API (Chuẩn Git) |
| :--- | :--- | :--- |
| **Lưu trữ** | Cơ sở dữ liệu đám mây độc quyền | File YAML thuần trên đĩa & Git |
| **Cộng tác** | Tính phí theo gói nhóm (Paywall) | Chuẩn Git PR & Git Branching |
| **Ngoại tuyến** | Bị giới hạn hoặc chặn sử dụng | Hoạt động 100% Offline |
| **Bảo mật bí mật** | Đẩy secret lên máy chủ bên thứ ba | Mã hóa AES-256-GCM tại máy |
| **Thu thập dữ liệu** | Thu thập hành vi & payload | 100% Không Telemetry |
| **Bộ nhớ RAM** | 800MB–2GB RAM (Electron) | <80MB RAM (Tauri + Rust) |

---

## Yêu cầu hệ thống

- **Hệ điều hành**: Linux (x86_64, aarch64), Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch Linux.
- **Bộ nhớ**: Tối thiểu 256MB RAM (Khuyến nghị 512MB).
- **Dung lượng đĩa**: Khoảng 120MB khi cài đặt.
- **Tùy chọn**: Git 2.25+ để sử dụng tối đa tính năng workspace Git.
`,
    },
  },

  installation: {
    id: "installation",
    category: "getting-started",
    readTime: "4 min",
    tags: ["install", "deb", "rpm", "appimage", "source"],
    title: {
      en: "Installation Guide",
      vi: "Hướng dẫn Cài đặt",
    },
    description: {
      en: "How to install Aether API on Debian, Ubuntu, Fedora, RHEL, Arch Linux, and building from source.",
      vi: "Cách cài đặt Aether API trên Debian, Ubuntu, Fedora, RHEL, Arch Linux và tự biên dịch từ mã nguồn.",
    },
    headings: {
      en: [
        { id: "debian-ubuntu", text: "Debian / Ubuntu (.deb)", level: 2 },
        { id: "fedora-rhel", text: "Fedora / RHEL (.rpm)", level: 2 },
        { id: "universal-appimage", text: "Universal Linux (.AppImage)", level: 2 },
        { id: "build-from-source", text: "Build from Source", level: 2 },
        { id: "verify-signatures", text: "Verifying GPG Signatures & Checksums", level: 2 },
      ],
      vi: [
        { id: "debian-ubuntu", text: "Debian / Ubuntu (.deb)", level: 2 },
        { id: "fedora-rhel", text: "Fedora / RHEL (.rpm)", level: 2 },
        { id: "universal-appimage", text: "Linux Phổ quát (.AppImage)", level: 2 },
        { id: "build-from-source", text: "Biên dịch từ mã nguồn", level: 2 },
        { id: "verify-signatures", text: "Xác thực Chữ ký GPG & Mã băm SHA256", level: 2 },
      ],
    },
    content: {
      en: `
## Debian / Ubuntu (.deb)

Download and install the official Debian package for Ubuntu 20.04+, Linux Mint, Pop!_OS, or Debian 11+:

\`\`\`bash
# 1. Download the latest .deb package
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/Aether.API_0.2.0_amd64.deb

# 2. Install the package with dpkg
sudo dpkg -i Aether.API_0.2.0_amd64.deb

# 3. Resolve any missing system runtime dependencies
sudo apt-get install -f -y
\`\`\`

---

## Fedora / RHEL (.rpm)

For Fedora, Red Hat Enterprise Linux, Rocky Linux, or CentOS Stream:

\`\`\`bash
# 1. Download the latest .rpm package
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/Aether.API-0.2.0-1.x86_64.rpm

# 2. Install with DNF package manager
sudo dnf install ./Aether.API-0.2.0-1.x86_64.rpm -y
\`\`\`

---

## Universal Linux (.AppImage)

The AppImage package works out of the box on virtually any modern Linux distribution without installation:

\`\`\`bash
# 1. Download the AppImage binary
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/Aether.API_0.2.0_amd64.AppImage

# 2. Make the file executable
chmod +x Aether.API_0.2.0_amd64.AppImage

# 3. Run Aether API
./Aether.API_0.2.0_amd64.AppImage
\`\`\`

> [!NOTE]
> If your system does not have FUSE enabled (e.g. Ubuntu 22.04+), install \`libfuse2\` using \`sudo apt install libfuse2\`, or run with \`./Aether.API_0.2.0_amd64.AppImage --appimage-extract-and-run\`.

---

## Build from Source

To build Aether API directly from the source repository:

\`\`\`bash
# 1. Clone repository
git clone https://github.com/Hephaestus-Studio/aether-api.git
cd aether-api

# 2. Install system build dependencies (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y \\
  libwebkit2gtk-4.1-dev build-essential curl wget \\
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# 3. Install frontend dependencies & run in dev mode
pnpm install
pnpm tauri dev

# 4. Build release bundle
pnpm tauri build
\`\`\`

---

## Verifying GPG Signatures & Checksums

Every official release artifact includes a detached GPG signature (\`.asc\`) and a SHA256 checksum file:

\`\`\`bash
# Download checksums
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/SHA256SUMS

# Verify SHA256 integrity
sha256sum --check --ignore-missing SHA256SUMS
\`\`\`
`,
      vi: `
## Debian / Ubuntu (.deb)

Tải và cài đặt gói .deb chính thức cho Ubuntu 20.04+, Linux Mint, Pop!_OS, hoặc Debian 11+:

\`\`\`bash
# 1. Tải gói .deb mới nhất
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/Aether.API_0.2.0_amd64.deb

# 2. Cài đặt bằng dpkg
sudo dpkg -i Aether.API_0.2.0_amd64.deb

# 3. Tự động khắc phục các gói phụ thuộc còn thiếu
sudo apt-get install -f -y
\`\`\`

---

## Fedora / RHEL (.rpm)

Dành cho Fedora, Red Hat Enterprise Linux, Rocky Linux, hoặc CentOS Stream:

\`\`\`bash
# 1. Tải gói .rpm mới nhất
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/Aether.API-0.2.0-1.x86_64.rpm

# 2. Cài đặt với trình quản lý gói DNF
sudo dnf install ./Aether.API-0.2.0-1.x86_64.rpm -y
\`\`\`

---

## Linux Phổ quát (.AppImage)

Định dạng AppImage có thể chạy trực tiếp trên hầu hết các bản phân phối Linux mà không cần cài đặt vào hệ thống:

\`\`\`bash
# 1. Tải file thực thi AppImage
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/Aether.API_0.2.0_amd64.AppImage

# 2. Cấp quyền thực thi
chmod +x Aether.API_0.2.0_amd64.AppImage

# 3. Khởi chạy Aether API
./Aether.API_0.2.0_amd64.AppImage
\`\`\`

> [!NOTE]
> Nếu hệ thống của bạn chưa cài FUSE (ví dụ Ubuntu 22.04+), hãy cài \`libfuse2\` bằng lệnh \`sudo apt install libfuse2\`, hoặc chạy \`./Aether.API_0.2.0_amd64.AppImage --appimage-extract-and-run\`.

---

## Biên dịch từ mã nguồn

Để tự xây dựng gói Aether API từ source code:

\`\`\`bash
# 1. Clone repository
git clone https://github.com/Hephaestus-Studio/aether-api.git
cd aether-api

# 2. Cài đặt gói thư viện hệ thống cần thiết (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y \\
  libwebkit2gtk-4.1-dev build-essential curl wget \\
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# 3. Cài đặt dependency & chạy ở chế độ dev
pnpm install
pnpm tauri dev

# 4. Đóng gói bản phát hành release
pnpm tauri build
\`\`\`

---

## Xác thực Chữ ký GPG & Mã băm SHA256

Mỗi bản phát hành chính thức đều đính kèm chữ ký GPG rời (\`.asc\`) và file mã băm SHA256:

\`\`\`bash
# Tải file SHA256SUMS
wget https://github.com/Hephaestus-Studio/aether-api/releases/latest/download/SHA256SUMS

# Kiểm tra tính toàn vẹn của tệp đã tải về
sha256sum --check --ignore-missing SHA256SUMS
\`\`\`
`,
    },
  },

  "first-request": {
    id: "first-request",
    category: "getting-started",
    readTime: "3 min",
    tags: ["quickstart", "workspace", "request", "http"],
    title: {
      en: "Quick Start: Your First Request",
      vi: "Bắt đầu Nhanh: Gửi Yêu cầu Đầu tiên",
    },
    description: {
      en: "Step-by-step guide to opening a workspace directory, creating collections, and executing your first API call.",
      vi: "Hướng dẫn từng bước mở thư mục workspace, tạo collection và thực thi yêu cầu API đầu tiên.",
    },
    headings: {
      en: [
        { id: "opening-workspace", text: "1. Open a Workspace Directory", level: 2 },
        { id: "creating-request", text: "2. Create a Collection & Request", level: 2 },
        { id: "sending-request", text: "3. Configure and Send the Request", level: 2 },
        { id: "inspecting-response", text: "4. Inspect Response & Headers", level: 2 },
      ],
      vi: [
        { id: "opening-workspace", text: "1. Mở thư mục Workspace", level: 2 },
        { id: "creating-request", text: "2. Tạo Collection & Yêu cầu", level: 2 },
        { id: "sending-request", text: "3. Cấu hình và Gửi yêu cầu", level: 2 },
        { id: "inspecting-response", text: "4. Kiểm tra Phản hồi & Headers", level: 2 },
      ],
    },
    content: {
      en: `
## 1. Open a Workspace Directory

When you launch Aether API, click **Open Workspace** (or press \`Ctrl+O\`) and select any directory on your computer (for example, your project's repository root: \`~/projects/my-api-service\`).

Aether API will automatically create a hidden \`.aether/\` directory inside to store configuration while keeping your project clean.

---

## 2. Create a Collection & Request

In the left Explorer panel:
1. Click **New Collection** and name it \`Authentication\`.
2. Right-click the collection and select **New Request** (or press \`Ctrl+N\`).
3. Name it \`Login User\`.

Behind the scenes, Aether API creates a clean YAML file at \`Authentication/Login User.yaml\`.

---

## 3. Configure and Send the Request

1. Select **POST** as the HTTP method.
2. Enter the target URL: \`https://httpbin.org/post\` (or use template variables like \`{{base_url}}/auth/login\`).
3. Under the **Body** tab, choose **JSON** and enter your payload:

\`\`\`json
{
  "username": "developer@aether.local",
  "password": "super-secret-token"
}
\`\`\`

4. Press **Send** (or shortcut \`Ctrl+Enter\`).

---

## 4. Inspect Response & Headers

The response panel displays:
- **Status Code & Timing**: e.g., \`200 OK • 142ms • 1.2 KB\`
- **Body Viewer**: Monaco-powered JSON editor with folding, syntax highlights, and search.
- **Headers & Cookies**: Complete server response headers and cookies.
- **Response Timeline**: TCP connection time, TLS handshake, DNS resolution, and Time-to-First-Byte (TTFB).
`,
      vi: `
## 1. Mở thư mục Workspace

Khi khởi chạy Aether API, hãy nhấp vào **Mở Workspace** (hoặc nhấn \`Ctrl+O\`) và chọn bất kỳ thư mục nào trên máy tính (ví dụ: thư mục repository dự án của bạn: \`~/projects/my-api-service\`).

Aether API sẽ tự động khởi tạo thư mục ẩn \`.aether/\` bên trong để lưu cấu hình mà không làm ảnh hưởng đến mã nguồn dự án của bạn.

---

## 2. Tạo Collection & Yêu cầu

Trong bảng Explorer bên trái:
1. Nhấp vào nút **New Collection** và đặt tên là \`Authentication\`.
2. Nhấp chuột phải vào collection vừa tạo và chọn **New Request** (hoặc nhấn \`Ctrl+N\`).
3. Đặt tên là \`Login User\`.

Hệ thống sẽ tự động tạo tệp YAML tại \`Authentication/Login User.yaml\`.

---

## 3. Cấu hình và Gửi yêu cầu

1. Chọn phương thức HTTP là **POST**.
2. Nhập URL mục tiêu: \`https://httpbin.org/post\` (hoặc dùng biến \`{{base_url}}/auth/login\`).
3. Chuyển sang tab **Body**, chọn kiểu dữ liệu **JSON** và nhập nội dung:

\`\`\`json
{
  "username": "developer@aether.local",
  "password": "super-secret-token"
}
\`\`\`

4. Nhấn nút **Gửi** (Send) hoặc dùng phím tắt \`Ctrl+Enter\`.

---

## 4. Kiểm tra Phản hồi & Headers

Bảng phản hồi bên phải sẽ hiển thị:
- **Mã trạng thái & Thời gian**: ví dụ \`200 OK • 142ms • 1.2 KB\`
- **Trình xem Body**: Trình soạn thảo Monaco với đầy đủ tính năng gấp khối mã, tô màu cú pháp và tìm kiếm.
- **Headers & Cookies**: Toàn bộ headers và cookies máy chủ trả về.
- **Response Timeline**: Chi tiết thời gian kết nối TCP, bắt tay TLS, phân giải DNS và TTFB.
`,
    },
  },

  "yaml-schema": {
    id: "yaml-schema",
    category: "git-architecture",
    readTime: "5 min",
    tags: ["yaml", "schema", "spec", "git", "storage"],
    title: {
      en: "YAML Storage & File Schema",
      vi: "Định dạng YAML & Cấu trúc File",
    },
    description: {
      en: "Detailed specification of Aether API's human-readable YAML file schema for requests, collections, and environments.",
      vi: "Đặc tả chi tiết cấu trúc tệp YAML dễ đọc của Aether API cho requests, collections và environments.",
    },
    headings: {
      en: [
        { id: "directory-layout", text: "Workspace Directory Layout", level: 2 },
        { id: "request-yaml", text: "Request YAML Specification", level: 2 },
        { id: "environment-yaml", text: "Environment YAML Specification", level: 2 },
      ],
      vi: [
        { id: "directory-layout", text: "Bố cục Thư mục Workspace", level: 2 },
        { id: "request-yaml", text: "Đặc tả Tệp Request YAML", level: 2 },
        { id: "environment-yaml", text: "Đặc tả Tệp Environment YAML", level: 2 },
      ],
    },
    content: {
      en: `
## Workspace Directory Layout

Aether API treats your workspace as a standard filesystem directory. A typical workspace looks like this:

\`\`\`text
my-api-project/
├── .aether/
│   ├── config.yaml          # Workspace preferences & active env
│   └── environments/
│       ├── development.yaml # Dev environment variables
│       ├── staging.yaml     # Staging variables
│       └── production.yaml  # Production (encrypted secrets)
├── Users/
│   ├── Get User Profile.yaml
│   └── Update Avatar.yaml
└── Orders/
    ├── List Orders.yaml
    └── Create Checkout.yaml
\`\`\`

---

## Request YAML Specification

Each request is saved as a clean, standalone \`.yaml\` file:

\`\`\`yaml
name: "Get User Profile"
method: "GET"
url: "{{base_url}}/api/v1/users/{{user_id}}"
headers:
  - key: "Accept"
    value: "application/json"
    enabled: true
  - key: "Authorization"
    value: "Bearer {{auth_token}}"
    enabled: true
params:
  - key: "include"
    value: "profile,permissions"
    enabled: true
auth:
  type: "bearer"
  token: "{{auth_token}}"
body:
  type: "json"
  content: ""
scripts:
  preRequest: |
    // Executed before sending
    console.log("Sending request to:", aether.request.url);
  postRequest: |
    // Executed after receiving response
    aether.assert(aether.response.status === 200, "Status must be 200");
\`\`\`

---

## Environment YAML Specification

Environments define scoped variables with optional AES-256-GCM encryption:

\`\`\`yaml
name: "Staging Environment"
variables:
  - key: "base_url"
    value: "https://staging-api.service.io"
    isSecret: false
    enabled: true
  - key: "api_key"
    value: "enc:v1:a98f12...encrypted_payload..."
    isSecret: true
    enabled: true
\`\`\`
`,
      vi: `
## Bố cục Thư mục Workspace

Aether API quản lý workspace như một thư mục chuẩn trên hệ thống tệp:

\`\`\`text
my-api-project/
├── .aether/
│   ├── config.yaml          # Cấu hình chung & môi trường đang chọn
│   └── environments/
│       ├── development.yaml # Biến môi trường dev
│       ├── staging.yaml     # Biến môi trường staging
│       └── production.yaml  # Biến production (mã hóa secret)
├── Users/
│   ├── Get User Profile.yaml
│   └── Update Avatar.yaml
└── Orders/
    ├── List Orders.yaml
    └── Create Checkout.yaml
\`\`\`

---

## Đặc tả Tệp Request YAML

Mỗi yêu cầu được lưu dưới dạng một tệp \`.yaml\` độc lập và rõ ràng:

\`\`\`yaml
name: "Get User Profile"
method: "GET"
url: "{{base_url}}/api/v1/users/{{user_id}}"
headers:
  - key: "Accept"
    value: "application/json"
    enabled: true
  - key: "Authorization"
    value: "Bearer {{auth_token}}"
    enabled: true
params:
  - key: "include"
    value: "profile,permissions"
    enabled: true
auth:
  type: "bearer"
  token: "{{auth_token}}"
body:
  type: "json"
  content: ""
scripts:
  preRequest: |
    // Chạy trước khi gửi
    console.log("Chuẩn bị gửi tới:", aether.request.url);
  postRequest: |
    // Chạy sau khi nhận phản hồi
    aether.assert(aether.response.status === 200, "Status phải là 200");
\`\`\`

---

## Đặc tả Tệp Environment YAML

File môi trường lưu danh sách biến với tùy chọn mã hóa an toàn:

\`\`\`yaml
name: "Môi trường Staging"
variables:
  - key: "base_url"
    value: "https://staging-api.service.io"
    isSecret: false
    enabled: true
  - key: "api_key"
    value: "enc:v1:a98f12...encrypted_payload..."
    isSecret: true
    enabled: true
\`\`\`
`,
    },
  },

  "git-workflow": {
    id: "git-workflow",
    category: "git-architecture",
    readTime: "4 min",
    tags: ["git", "collaboration", "pr", "diff", "branch"],
    title: {
      en: "Git Branching & Pull Request Workflow",
      vi: "Quy trình Phân nhánh Git & Pull Request",
    },
    description: {
      en: "How engineering teams use standard Git PRs and code reviews for API collections.",
      vi: "Cách các nhóm kỹ sư sử dụng Git PR và Code Review chuẩn để quản lý các bộ sưu tập API.",
    },
    headings: {
      en: [
        { id: "team-workflow", text: "Team Collaboration Workflow", level: 2 },
        { id: "reviewing-prs", text: "Reviewing API Changes in Git Diff", level: 2 },
        { id: "ci-cd-integration", text: "CI/CD Pipeline Integration", level: 2 },
      ],
      vi: [
        { id: "team-workflow", text: "Quy trình Cộng tác Nhóm", level: 2 },
        { id: "reviewing-prs", text: "Duyệt Thay đổi API qua Git Diff", level: 2 },
        { id: "ci-cd-integration", text: "Tích hợp vào Quy trình CI/CD", level: 2 },
      ],
    },
    content: {
      en: `
## Team Collaboration Workflow

Collaborating in Aether API uses your existing Git branch and PR workflow:

1. **Create a Feature Branch**:
   \`\`\`bash
   git checkout -b feature/user-billing-api
   \`\`\`
2. **Design or Update Requests** in Aether API UI. The changes are saved immediately as YAML files.
3. **Commit & Push**:
   \`\`\`bash
   git add Billing/
   git commit -m "feat(api): add stripe webhook verification request"
   git push origin feature/user-billing-api
   \`\`\`
4. **Open a GitHub/GitLab PR**: Reviewers see the exact API contract differences directly in the PR diff!

---

## Reviewing API Changes in Git Diff

Because Aether API YAML files are clean and atomic, Git diffs are crystal clear:

\`\`\`diff
--- a/Billing/Checkout.yaml
+++ b/Billing/Checkout.yaml
@@ -3,6 +3,7 @@ method: "POST"
 url: "{{base_url}}/v2/checkout"
 headers:
   - key: "Idempotency-Key"
+    value: "{{$guid}}"
     enabled: true
\`\`\`

---

## CI/CD Pipeline Integration

Because requests are standard YAML files, you can lint them in GitHub Actions or execute them in automated end-to-end tests using the Aether CLI runner.
`,
      vi: `
## Quy trình Cộng tác Nhóm

Làm việc nhóm trong Aether API hoàn toàn đồng nhất với quy trình Git branch & PR quen thuộc:

1. **Tạo nhánh tính năng**:
   \`\`\`bash
   git checkout -b feature/user-billing-api
   \`\`\`
2. **Thiết kế hoặc Sửa Request** trên giao diện Aether API. Tệp YAML được cập nhật tức thì.
3. **Commit & Đẩy lên Git**:
   \`\`\`bash
   git add Billing/
   git commit -m "feat(api): thêm request xác thực stripe webhook"
   git push origin feature/user-billing-api
   \`\`\`
4. **Mở Pull Request**: Người review có thể nhìn thấy sự thay đổi chính xác của API ngay trên Git PR!

---

## Duyệt Thay đổi API qua Git Diff

Nhờ định dạng YAML tinh gọn, Git diff thể hiện sự thay đổi vô cùng trực quan:

\`\`\`diff
--- a/Billing/Checkout.yaml
+++ b/Billing/Checkout.yaml
@@ -3,6 +3,7 @@ method: "POST"
 url: "{{base_url}}/v2/checkout"
 headers:
   - key: "Idempotency-Key"
+    value: "{{$guid}}"
     enabled: true
\`\`\`

---

## Tích hợp vào Quy trình CI/CD

Vì request là các tệp YAML chuẩn, bạn có thể dễ dàng kiểm tra lint trong GitHub Actions hoặc tự động chạy test hồi quy (E2E) bằng Aether CLI.
`,
    },
  },

  "crypto-model": {
    id: "crypto-model",
    category: "security",
    readTime: "4 min",
    tags: ["security", "encryption", "aes-256", "pbkdf2", "vault"],
    title: {
      en: "Cryptographic Architecture & Vault",
      vi: "Kiến trúc Mã hóa & Két Bảo mật",
    },
    description: {
      en: "Learn how Aether API protects secrets with PBKDF2 master key derivation and AES-256-GCM local authenticated encryption.",
      vi: "Tìm hiểu cách Aether API bảo vệ secret bằng thuật toán sinh khóa PBKDF2 và mã hóa xác thực AES-256-GCM.",
    },
    headings: {
      en: [
        { id: "encryption-pipeline", text: "Encryption Pipeline", level: 2 },
        { id: "zero-knowledge", text: "Zero-Knowledge Principle", level: 2 },
        { id: "sharing-safely", text: "Sharing Repositories Safely", level: 2 },
      ],
      vi: [
        { id: "encryption-pipeline", text: "Quy trình Mã hóa", level: 2 },
        { id: "zero-knowledge", text: "Nguyên lý Zero-Knowledge", level: 2 },
        { id: "sharing-safely", text: "Chia sẻ Kho mã nguồn An toàn", level: 2 },
      ],
    },
    content: {
      en: `
## Encryption Pipeline

Aether API uses military-grade cryptography to ensure sensitive tokens and passwords can never be leaked in plaintext:

1. **Key Derivation (PBKDF2)**: Your master passphrase is run through **PBKDF2-HMAC-SHA256** with 100,000 iterations and a unique 32-byte cryptographic salt.
2. **Authenticated Encryption (AES-256-GCM)**: Sensitive variables are encrypted using **AES-256 in Galois/Counter Mode (GCM)** with a unique 12-byte initialization vector (IV) per variable.
3. **Payload Format**: Encrypted values stored on disk use the transparent format:
   \`enc:v1:<salt_hex>:<iv_hex>:<ciphertext_hex>:<tag_hex>\`

---

## Zero-Knowledge Principle

- **No Cloud Escrow**: Your master passphrase is never sent over any network.
- **In-Memory Only**: Decrypted secrets exist in volatile memory only while your session is unlocked and are securely zeroed out on lock.

---

## Sharing Repositories Safely

You can safely commit your \`.aether/environments/\` folder to public or private Git repositories. Any variable marked as **Secret** is committed only in encrypted ciphertext.
`,
      vi: `
## Quy trình Mã hóa

Aether API sử dụng các thuật toán mã hóa tiêu chuẩn công nghiệp nhằm đảm bảo token và mật khẩu nhạy cảm không bao giờ bị lộ:

1. **Sinh khóa chính (PBKDF2)**: Mật khẩu chính của bạn được dẫn xuất qua **PBKDF2-HMAC-SHA256** với 100.000 vòng lặp và muối mã hóa (salt) ngẫu nhiên 32-byte.
2. **Mã hóa xác thực (AES-256-GCM)**: Các giá trị bí mật được mã hóa bằng **AES-256-GCM** kèm vector khởi tạo (IV) ngẫu nhiên 12-byte cho mỗi biến.
3. **Định dạng lưu trữ**: Dữ liệu mã hóa lưu trên đĩa có định dạng:
   \`enc:v1:<salt_hex>:<iv_hex>:<ciphertext_hex>:<tag_hex>\`

---

## Nguyên lý Zero-Knowledge

- **Không gửi lên máy chủ**: Mật khẩu chính không bao giờ rời khỏi thiết bị của bạn.
- **Lưu trong RAM tạm thời**: Giá trị giải mã chỉ tồn tại trong bộ nhớ RAM khi mở khóa và bị xóa sạch ngay khi khóa két bảo mật.

---

## Chia sẻ Kho mã nguồn An toàn

Bạn có thể yên tâm commit thư mục \`.aether/environments/\` lên GitHub. Mọi biến được đánh dấu là **Secret** đều được lưu trữ dưới dạng bản mã an toàn tuyệt đối.
`,
    },
  },

  "scripting-basics": {
    id: "scripting-basics",
    category: "scripting",
    readTime: "5 min",
    tags: ["scripting", "javascript", "hooks", "lifecycle"],
    title: {
      en: "JavaScript Scripting & Lifecycle Hooks",
      vi: "Scripting JavaScript & Vòng đời Yêu cầu",
    },
    description: {
      en: "Execute dynamic JavaScript before sending requests and assert response bodies, status codes, and headers.",
      vi: "Thực thi JavaScript trước khi gửi request và kiểm thử response body, status code và headers.",
    },
    headings: {
      en: [
        { id: "execution-lifecycle", text: "Request Execution Lifecycle", level: 2 },
        { id: "pre-request-scripts", text: "Pre-Request Scripting", level: 2 },
        { id: "post-request-scripts", text: "Post-Request Scripting & Assertions", level: 2 },
      ],
      vi: [
        { id: "execution-lifecycle", text: "Vòng đời Thực thi Yêu cầu", level: 2 },
        { id: "pre-request-scripts", text: "Pre-Request Scripts (Trước khi gửi)", level: 2 },
        {
          id: "post-request-scripts",
          text: "Post-Request Scripts (Sau khi nhận phản hồi)",
          level: 2,
        },
      ],
    },
    content: {
      en: `
## Request Execution Lifecycle

When sending a request, Aether API executes scripts in a sandboxed JavaScript runtime:

1. **Pre-Request Script**: Calculate timestamps, dynamic HMAC signatures, or inject auth headers.
2. **HTTP Execution**: Rust Reqwest engine performs DNS resolution, TLS handshake, and sends the payload.
3. **Post-Request Script**: Validate response status, parse JSON body, assert schemas, and set environment variables.

---

## Pre-Request Scripting

Use the global \`aether\` object to inspect or modify the outgoing request:

\`\`\`javascript
// Generate dynamic timestamp header
const timestamp = Math.floor(Date.now() / 1000);
aether.request.headers.set("X-Timestamp", timestamp.toString());

// Read variable from active environment
const apiKey = aether.environment.get("api_key");

// Compute dynamic signature
const signature = aether.crypto.sha256(apiKey + timestamp);
aether.request.headers.set("X-Signature", signature);
\`\`\`

---

## Post-Request Scripting & Assertions

\`\`\`javascript
// Assert status code
aether.assert(aether.response.status === 200, "Expected HTTP 200 OK");

// Parse JSON response body
const body = JSON.parse(aether.response.body);

// Verify response schema
aether.assert(body.success === true, "Response must indicate success");
aether.assert(typeof body.data.token === "string", "Auth token must be a string");

// Automatically save auth token to environment for subsequent requests
aether.environment.set("auth_token", body.data.token);
console.log("Saved new auth token to environment!");
\`\`\`
`,
      vi: `
## Vòng đời Thực thi Yêu cầu

Khi gửi request, Aether API thực thi script trong môi trường JavaScript độc lập:

1. **Pre-Request Script**: Tính toán timestamp, chữ ký HMAC hoặc chèn token xác thực.
2. **Thực thi HTTP**: Engine Rust Reqwest phân giải DNS, bắt tay TLS và truyền tải dữ liệu.
3. **Post-Request Script**: Kiểm thử status code, parse JSON body, kiểm tra schema và lưu biến môi trường.

---

## Pre-Request Scripts (Trước khi gửi)

Sử dụng đối tượng toàn cục \`aether\` để đọc và chỉnh sửa request trước khi gửi:

\`\`\`javascript
// Tạo header timestamp động
const timestamp = Math.floor(Date.now() / 1000);
aether.request.headers.set("X-Timestamp", timestamp.toString());

// Đọc biến từ môi trường đang kích hoạt
const apiKey = aether.environment.get("api_key");

// Tính chữ ký băm
const signature = aether.crypto.sha256(apiKey + timestamp);
aether.request.headers.set("X-Signature", signature);
\`\`\`

---

## Post-Request Scripts (Sau khi nhận phản hồi)

\`\`\`javascript
// Kiểm tra mã trạng thái HTTP
aether.assert(aether.response.status === 200, "Kỳ vọng HTTP 200 OK");

// Đọc nội dung phản hồi JSON
const body = JSON.parse(aether.response.body);

// Kiểm tra cấu trúc dữ liệu
aether.assert(body.success === true, "Response phải trả về success: true");
aether.assert(typeof body.data.token === "string", "Token phải là chuỗi string");

// Tự động lưu token vào môi trường để dùng cho các request tiếp theo
aether.environment.set("auth_token", body.data.token);
console.log("Đã lưu token mới vào Environment!");
\`\`\`
`,
    },
  },

  shortcuts: {
    id: "shortcuts",
    category: "productivity",
    readTime: "3 min",
    tags: ["shortcuts", "keyboard", "hotkeys", "productivity"],
    title: {
      en: "Keyboard Shortcuts & Power Tools",
      vi: "Phím tắt & Công cụ Nâng cao",
    },
    description: {
      en: "Complete keyboard shortcuts reference for tabs, workspaces, request execution, and terminal navigation.",
      vi: "Bảng tra cứu phím tắt đầy đủ cho quản lý tab, workspace, gửi request và thao tác terminal.",
    },
    headings: {
      en: [
        { id: "request-shortcuts", text: "Request & Execution", level: 2 },
        { id: "navigation-shortcuts", text: "Navigation & Tabs", level: 2 },
        { id: "terminal-shortcuts", text: "Terminal & Panels", level: 2 },
      ],
      vi: [
        { id: "request-shortcuts", text: "Thao tác Yêu cầu & Gửi", level: 2 },
        { id: "navigation-shortcuts", text: "Điều hướng & Tab", level: 2 },
        { id: "terminal-shortcuts", text: "Terminal & Bảng điều khiển", level: 2 },
      ],
    },
    content: {
      en: `
## Request & Execution

| Action | Shortcut (Linux/Windows) | Shortcut (macOS) |
| :--- | :--- | :--- |
| **Send Active Request** | \`Ctrl + Enter\` | \`Cmd + Enter\` |
| **Save Active Request** | \`Ctrl + S\` | \`Cmd + S\` |
| **New Request** | \`Ctrl + N\` | \`Cmd + N\` |
| **Code Snippet Generator** | \`Ctrl + Shift + C\` | \`Cmd + Shift + C\` |

---

## Navigation & Tabs

| Action | Shortcut (Linux/Windows) | Shortcut (macOS) |
| :--- | :--- | :--- |
| **Quick Open File** | \`Ctrl + P\` | \`Cmd + P\` |
| **Search Open Tabs** | \`Ctrl + Shift + A\` | \`Cmd + Shift + A\` |
| **Command Palette** | \`Ctrl + Shift + P\` | \`Cmd + Shift + P\` |
| **Close Active Tab** | \`Ctrl + W\` | \`Cmd + W\` |
| **Next / Previous Tab** | \`Ctrl + Tab\` / \`Ctrl + Shift + Tab\` | \`Ctrl + Tab\` / \`Ctrl + Shift + Tab\` |

---

## Terminal & Panels

| Action | Shortcut (Linux/Windows) | Shortcut (macOS) |
| :--- | :--- | :--- |
| **Toggle Terminal Panel** | \`Ctrl + \`\` (Backtick) | \`Cmd + \`\` (Backtick) |
| **New Terminal Tab** | \`Ctrl + Shift + T\` | \`Cmd + Shift + T\` |
| **Toggle Sidebar** | \`Ctrl + B\` | \`Cmd + B\` |
`,
      vi: `
## Thao tác Yêu cầu & Gửi

| Thao tác | Phím tắt (Linux/Windows) | Phím tắt (macOS) |
| :--- | :--- | :--- |
| **Gửi yêu cầu hiện tại** | \`Ctrl + Enter\` | \`Cmd + Enter\` |
| **Lưu yêu cầu hiện tại** | \`Ctrl + S\` | \`Cmd + S\` |
| **Tạo yêu cầu mới** | \`Ctrl + N\` | \`Cmd + N\` |
| **Mở Trình tạo Code Snippet** | \`Ctrl + Shift + C\` | \`Cmd + Shift + C\` |

---

## Điều hướng & Tab

| Thao tác | Phím tắt (Linux/Windows) | Phím tắt (macOS) |
| :--- | :--- | :--- |
| **Mở nhanh tệp / request** | \`Ctrl + P\` | \`Cmd + P\` |
| **Tìm kiếm các Tab đang mở** | \`Ctrl + Shift + A\` | \`Cmd + Shift + A\` |
| **Bảng lệnh Command Palette** | \`Ctrl + Shift + P\` | \`Cmd + Shift + P\` |
| **Đóng Tab hiện tại** | \`Ctrl + W\` | \`Cmd + W\` |
| **Chuyển Tab kế tiếp / trước** | \`Ctrl + Tab\` / \`Ctrl + Shift + Tab\` | \`Ctrl + Tab\` / \`Ctrl + Shift + Tab\` |

---

## Terminal & Bảng điều khiển

| Thao tác | Phím tắt (Linux/Windows) | Phím tắt (macOS) |
| :--- | :--- | :--- |
| **Bật / Tắt bảng Terminal** | \`Ctrl + \`\` (Dấu huyền) | \`Cmd + \`\` (Dấu huyền) |
| **Tạo tab Terminal mới** | \`Ctrl + Shift + T\` | \`Cmd + Shift + T\` |
| **Thu gọn / Mở Sidebar** | \`Ctrl + B\` | \`Cmd + B\` |
`,
    },
  },

  "from-postman": {
    id: "from-postman",
    category: "migration",
    readTime: "3 min",
    tags: ["migration", "postman", "import", "convert"],
    title: {
      en: "Migrating from Postman",
      vi: "Chuyển đổi từ Postman",
    },
    description: {
      en: "How to export your collections and environments from Postman v2.1 format directly into Aether API.",
      vi: "Cách xuất bộ sưu tập và biến môi trường từ Postman v2.1 sang Aether API.",
    },
    headings: {
      en: [
        { id: "export-postman", text: "1. Export Collections from Postman", level: 2 },
        { id: "import-aether", text: "2. Import into Aether API", level: 2 },
        { id: "git-commit-imported", text: "3. Commit to Your Repository", level: 2 },
      ],
      vi: [
        { id: "export-postman", text: "1. Xuất Collection từ Postman", level: 2 },
        { id: "import-aether", text: "2. Nhập vào Aether API", level: 2 },
        { id: "git-commit-imported", text: "3. Commit vào Git Repository", level: 2 },
      ],
    },
    content: {
      en: `
## 1. Export Collections from Postman

1. Open Postman.
2. In the left sidebar, click the **...** (three dots) next to your collection $\rightarrow$ **Export**.
3. Select **Collection v2.1 (recommended)** and save the \`.json\` file.
4. Export your Environments: Go to **Environments** $\rightarrow$ click **...** $\rightarrow$ **Export**.

---

## 2. Import into Aether API

1. Open your workspace in Aether API.
2. Click **File** $\rightarrow$ **Import Collection** (or drag and drop the \`.json\` file into the Explorer panel).
3. Aether API automatically parses the Postman JSON and converts every folder and request into clean, individual \`.yaml\` files.

---

## 3. Commit to Your Repository

Once imported, review the generated YAML files and commit them to Git:

\`\`\`bash
git add .
git commit -m "chore: import api collections from postman"
git push origin main
\`\`\`
`,
      vi: `
## 1. Xuất Collection từ Postman

1. Mở ứng dụng Postman.
2. Ở danh sách bên trái, nhấp vào biểu tượng **...** cạnh collection cần xuất $\rightarrow$ chọn **Export**.
3. Chọn định dạng **Collection v2.1 (recommended)** và lưu tệp \`.json\`.
4. Xuất biến môi trường: Vào mục **Environments** $\rightarrow$ nhấp **...** $\rightarrow$ chọn **Export**.

---

## 2. Nhập vào Aether API

1. Mở workspace trong Aether API.
2. Chọn **File** $\rightarrow$ **Import Collection** (hoặc kéo thả trực tiếp tệp \`.json\` vào bảng Explorer).
3. Aether API sẽ tự động phân tích và chuyển đổi cấu trúc JSON sang các tệp \`.yaml\` độc lập và gọn gàng.

---

## 3. Commit vào Git Repository

Sau khi nhập thành công, bạn chỉ cần commit các tệp YAML vào Git:

\`\`\`bash
git add .
git commit -m "chore: import api collections from postman"
git push origin main
\`\`\`
`,
    },
  },
};

// Fallback lookup if article is missing
export function getArticleById(id: string): DocArticle {
  return DOC_ARTICLES[id] || DOC_ARTICLES["overview"];
}

// Search across articles
export function searchDocs(query: string, lang: "en" | "vi") {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = [];
  for (const article of Object.values(DOC_ARTICLES)) {
    const title = article.title[lang];
    const desc = article.description[lang];
    const content = article.content[lang];
    const tags = article.tags.join(" ");

    let score = 0;
    if (title.toLowerCase().includes(q)) score += 10;
    if (tags.toLowerCase().includes(q)) score += 5;
    if (desc.toLowerCase().includes(q)) score += 3;
    if (content.toLowerCase().includes(q)) score += 1;

    if (score > 0) {
      const cat = DOC_CATEGORIES.find((c) => c.id === article.category);
      results.push({
        articleId: article.id,
        title,
        description: desc,
        category: cat ? cat.title[lang] : "",
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

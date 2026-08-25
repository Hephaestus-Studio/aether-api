export type Language = "en" | "vi";

export interface Translations {
  nav: {
    whyAether: string;
    features: string;
    docs: string;
    download: string;
    shortcuts: string;
    changelog: string;
    starGitHub: string;
    menu: string;
    close: string;
  };
  hero: {
    releaseBadge: string;
    betaBadge: string;
    titleLine1: string;
    titleHighlight: string;
    subtitle: string;
    downloadLinux: string;
    downloadStable: string;
    downloadBeta: string;
    stableLabel: string;
    betaLabel: string;
    recommended: string;
    earlyAccess: string;
    betaDisclaimer: string;
    whyAetherBtn: string;
    downloads: {
      universal: string;
      debian: string;
      fedora: string;
      checksums: string;
    };
  };
  comparison: {
    badge: string;
    title: string;
    description: string;
    tableHeaders: {
      feature: string;
      aether: string;
      traditional: string;
    };
    rows: {
      storage: {
        title: string;
        desc: string;
        aether: string;
        traditional: string;
      };
      privacy: {
        title: string;
        desc: string;
        aether: string;
        traditional: string;
      };
      encryption: {
        title: string;
        desc: string;
        aether: string;
        traditional: string;
      };
      engine: {
        title: string;
        desc: string;
        aether: string;
        traditional: string;
      };
      terminal: {
        title: string;
        desc: string;
        aether: string;
        traditional: string;
      };
      gitWorkflow: {
        title: string;
        desc: string;
        aether: string;
        traditional: string;
      };
    };
  };
  features: {
    badge: string;
    title: string;
    description: string;
    items: {
      git: {
        title: string;
        desc: string;
      };
      security: {
        title: string;
        desc: string;
      };
      terminal: {
        title: string;
        desc: string;
      };
      generator: {
        title: string;
        desc: string;
      };
      autocomplete: {
        title: string;
        desc: string;
      };
      quickOpen: {
        title: string;
        desc: string;
      };
    };
  };
  install: {
    badge: string;
    title: string;
    description: string;
    channelLabel: string;
    channelStable: string;
    channelBeta: string;
    tabs: {
      deb: string;
      rpm: string;
      appimage: string;
      source: string;
    };
    copy: string;
    copied: string;
    terminalTitle: string;
    comments: {
      deb1: string;
      deb2: string;
      deb3: string;
      rpm1: string;
      rpm2: string;
      appimage1: string;
      appimage2: string;
      source1: string;
      source2: string;
      source3: string;
    };
  };
  shortcuts: {
    badge: string;
    title: string;
    description: string;
    items: {
      sendRequest: string;
      saveRequest: string;
      searchTabs: string;
      quickOpen: string;
      commandPalette: string;
      toggleTerminal: string;
      closeTab: string;
      openFolder: string;
    };
  };
  footer: {
    brandSubtitle: string;
    github: string;
    releases: string;
    docs: string;
    license: string;
    changelog: string;
    credit: string;
    mitNote: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      whyAether: "Why Aether",
      features: "Features",
      docs: "Docs",
      download: "Download",
      shortcuts: "Shortcuts",
      changelog: "Changelog",
      starGitHub: "Star on GitHub",
      menu: "Menu",
      close: "Close",
    },
    hero: {
      releaseBadge: "Release {version} is now available!",
      betaBadge: "Beta {version} is ready for preview!",
      titleLine1: "Your APIs. Your Files.",
      titleHighlight: "Your Control.",
      subtitle:
        "The modern, open-source API client that stores everything as plain YAML files in your Git repository. Zero telemetry, on-device encryption, and native Rust performance.",
      downloadLinux: "Download for Linux",
      downloadStable: "Download Stable",
      downloadBeta: "Download Beta Preview",
      stableLabel: "Stable",
      betaLabel: "Beta",
      recommended: "Recommended",
      earlyAccess: "Early Access",
      betaDisclaimer: "Includes the latest preview features; may contain occasional bugs.",
      whyAetherBtn: "Why Aether?",
      downloads: {
        universal: "Universal Linux",
        debian: "Debian / Ubuntu",
        fedora: "Fedora / RHEL",
        checksums: "GPG & Checksums",
      },
    },
    comparison: {
      badge: "Comparison",
      title: "Built for Engineers Who Value Privacy & Speed",
      description:
        "Tired of vendor lock-in, mandatory cloud logins, and multi-gigabyte RAM usage? See how Aether API compares to traditional API clients.",
      tableHeaders: {
        feature: "Feature / Architecture",
        aether: "⚡ Aether API (Local-First)",
        traditional: "Traditional Cloud Clients",
      },
      rows: {
        storage: {
          title: "Storage & Collaboration",
          desc: "How collections and requests are stored and shared",
          aether: "Plain YAML files in Git",
          traditional: "Proprietary Cloud Sync",
        },
        privacy: {
          title: "Privacy & Telemetry",
          desc: "Whether your payloads, tokens, and data leave your device",
          aether: "100% Zero Telemetry",
          traditional: "Telemetry & Tracking",
        },
        encryption: {
          title: "Secret Encryption",
          desc: "Protection for API keys, passwords, and tokens",
          aether: "AES-256-GCM On-Device",
          traditional: "Stored on Cloud Servers",
        },
        engine: {
          title: "Engine & Memory Footprint",
          desc: "Runtime performance and system resource consumption",
          aether: "Tauri v2 + Rust Reqwest (<80MB)",
          traditional: "Heavy Electron (>800MB RAM)",
        },
        terminal: {
          title: "Integrated Terminal",
          desc: "Run git, curl, npm directly inside workspace",
          aether: "Native Multi-Tab PTY Terminal",
          traditional: "Not Available",
        },
        gitWorkflow: {
          title: "Git Workflow Integration",
          desc: "Branching, Code Review, and Pull Requests",
          aether: "Standard Git PRs & Diffs",
          traditional: "Paywalled Team Tiers",
        },
      },
    },
    features: {
      badge: "Capabilities",
      title: "Engineered for Frictionless API Workflows",
      description:
        "Every tool and UI interaction in Aether API was crafted to maximize developer velocity without compromising privacy.",
      items: {
        git: {
          title: "Git-Centric Workspaces",
          desc: "Workspaces are real directories on your disk. Requests and environments are saved as human-readable YAML files, ready for instant branch switches, merges, and code reviews.",
        },
        security: {
          title: "AES-256 Secret Masking",
          desc: "Environment variables support secret masking with toggleable eye icons. Sensitive passwords and tokens are securely encrypted on-device using a master passphrase.",
        },
        terminal: {
          title: "Embedded Multi-Tab Terminal",
          desc: "Built-in native PTY terminal powered by Rust and xterm.js. Run git status, pull, push, curl, or backend dev servers without leaving your workspace window.",
        },
        generator: {
          title: "Code Snippet Generator",
          desc: "Transform any HTTP request into production-ready client code with 1 click: cURL, Fetch API, Python Requests, Rust Reqwest, Go net/http, Java OkHttp, and HTTPie.",
        },
        autocomplete: {
          title: "Variable Autocomplete",
          desc: "Type {{ anywhere in URLs, Headers, Auth, or Bodies to trigger smart variable autocomplete with keyboard navigation and instant value preview tooltips.",
        },
        quickOpen: {
          title: "Quick Open & Tab Search",
          desc: "Press Ctrl+Shift+A to search open tabs by method or URL with dirty-dot indicators, or Ctrl+P to instantly open any request file in the workspace.",
        },
      },
    },
    install: {
      badge: "Get Started",
      title: "Install on Linux in Seconds",
      description: "Choose your preferred Linux package format or build directly from source.",
      channelLabel: "Release Channel",
      channelStable: "Stable ({version})",
      channelBeta: "Beta ({version})",
      tabs: {
        deb: "Debian / Ubuntu (.deb)",
        rpm: "Fedora / RHEL (.rpm)",
        appimage: "Universal (.AppImage)",
        source: "Build from Source",
      },
      copy: "Copy",
      copied: "Copied!",
      terminalTitle: "bash — installation",
      comments: {
        deb1: "# 1. Download Debian/Ubuntu package",
        deb2: "# 2. Install package",
        deb3: "# resolve any missing dependencies",
        rpm1: "# 1. Download Fedora/RHEL package",
        rpm2: "# 2. Install with dnf or rpm",
        appimage1: "# 1. Download Universal AppImage",
        appimage2: "# 2. Make executable and run",
        source1: "# 1. Clone repository",
        source2: "# 2. Install dependencies & run development server",
        source3: "# 3. Build release bundle",
      },
    },
    shortcuts: {
      badge: "Power Tools",
      title: "Built for Keyboard Power Users",
      description:
        "Execute requests, search tabs, navigate workspace, and toggle terminals without touching the mouse.",
      items: {
        sendRequest: "Send Active Request",
        saveRequest: "Save Current Request",
        searchTabs: "Search Open Tabs",
        quickOpen: "Quick Open Request / File",
        commandPalette: "Command Palette",
        toggleTerminal: "Toggle Terminal Panel",
        closeTab: "Close Active Tab",
        openFolder: "Open Workspace Folder",
      },
    },
    footer: {
      brandSubtitle: "Next-Generation Local-First & Git-Centric API Client.",
      github: "GitHub",
      releases: "Releases",
      docs: "Documentation",
      license: "MIT License",
      changelog: "Changelog",
      credit: "Built with ♥ by",
      mitNote: "Released under the MIT License.",
    },
  },
  vi: {
    nav: {
      whyAether: "Tại sao chọn Aether",
      features: "Tính năng",
      docs: "Tài liệu",
      download: "Tải về",
      shortcuts: "Phím tắt",
      changelog: "Nhật ký",
      starGitHub: "Star trên GitHub",
      menu: "Menu",
      close: "Đóng",
    },
    hero: {
      releaseBadge: "Bản phát hành {version} đã sẵn sàng!",
      betaBadge: "Bản thử nghiệm Beta {version} đã sẵn sàng!",
      titleLine1: "API Của Bạn. Tệp Của Bạn.",
      titleHighlight: "Quyền Kiểm Soát Của Bạn.",
      subtitle:
        "API client mã nguồn mở hiện đại, lưu trữ toàn bộ dữ liệu dưới dạng tệp YAML thuần trong kho Git của bạn. Không thu thập dữ liệu (Zero telemetry), mã hóa trực tiếp trên thiết bị và hiệu năng Rust vượt trội.",
      downloadLinux: "Tải về cho Linux",
      downloadStable: "Tải bản Ổn định",
      downloadBeta: "Tải bản Beta Thử nghiệm",
      stableLabel: "Bản Ổn định",
      betaLabel: "Bản Beta",
      recommended: "Khuyên dùng",
      earlyAccess: "Trải nghiệm sớm",
      betaDisclaimer: "Bao gồm các tính năng thử nghiệm mới nhất; có thể còn lỗi nhỏ.",
      whyAetherBtn: "Tại sao chọn Aether?",
      downloads: {
        universal: "Linux Phổ quát",
        debian: "Debian / Ubuntu",
        fedora: "Fedora / RHEL",
        checksums: "Chữ ký GPG & Checksum",
      },
    },
    comparison: {
      badge: "So sánh",
      title: "Dành Cho Kỹ Sư Coi Trọng Quyền Riêng Tư & Tốc Độ",
      description:
        "Mệt mỏi với việc bị khóa vào nhà cung cấp, bắt buộc đăng nhập đám mây và ngốn hàng GB RAM? Hãy xem Aether API vượt trội hơn các client truyền thống như thế nào.",
      tableHeaders: {
        feature: "Tính năng / Kiến trúc",
        aether: "⚡ Aether API (Local-First)",
        traditional: "Client Đám Mây Truyền Thống",
      },
      rows: {
        storage: {
          title: "Lưu trữ & Cộng tác",
          desc: "Cách lưu trữ và chia sẻ các bộ sưu tập và yêu cầu API",
          aether: "Tệp YAML thuần trong Git",
          traditional: "Đồng bộ đám mây độc quyền",
        },
        privacy: {
          title: "Quyền riêng tư & Telemetry",
          desc: "Dữ liệu, token và payload có rời khỏi thiết bị của bạn không",
          aether: "100% Không thu thập dữ liệu",
          traditional: "Theo dõi & gửi dữ liệu đám mây",
        },
        encryption: {
          title: "Mã hóa Bí mật",
          desc: "Bảo vệ khóa API, mật khẩu và token nhạy cảm",
          aether: "AES-256-GCM trên thiết bị",
          traditional: "Lưu trữ trên máy chủ đám mây",
        },
        engine: {
          title: "Nền tảng & Tiêu tốn bộ nhớ",
          desc: "Hiệu năng khi chạy và mức tiêu thụ tài nguyên máy",
          aether: "Tauri v2 + Rust Reqwest (<80MB)",
          traditional: "Electron nặng nề (>800MB RAM)",
        },
        terminal: {
          title: "Terminal tích hợp sẵn",
          desc: "Chạy git, curl, npm trực tiếp ngay trong không gian làm việc",
          aether: "Terminal PTY đa tab nguyên bản",
          traditional: "Không hỗ trợ",
        },
        gitWorkflow: {
          title: "Tích hợp quy trình Git",
          desc: "Phân nhánh, xem xét mã (Code Review) và Pull Request",
          aether: "Phân nhánh & Diff chuẩn qua Git PR",
          traditional: "Thu phí theo gói nhóm (Paywall)",
        },
      },
    },
    features: {
      badge: "Tính năng nổi bật",
      title: "Thiết Kế Cho Quy Trình Làm Việc Mượt Mà",
      description:
        "Mọi công cụ và tương tác trong Aether API đều được tinh chỉnh để tối đa hóa tốc độ phát triển mà không đánh đổi quyền riêng tư.",
      items: {
        git: {
          title: "Không Gian Làm Việc Chuẩn Git",
          desc: "Workspace là thư mục thực trên ổ đĩa. Yêu cầu và biến môi trường được lưu dưới dạng tệp YAML dễ đọc, sẵn sàng chuyển nhánh, merge và duyệt code tức thì.",
        },
        security: {
          title: "Ẩn & Mã Hóa Bí Mật AES-256",
          desc: "Biến môi trường hỗ trợ che giấu giá trị nhạy cảm với biểu tượng con mắt. Mật khẩu và token được mã hóa an toàn trên máy bằng mật mã chính (master passphrase).",
        },
        terminal: {
          title: "Terminal Đa Tab Tích Hợp Sẵn",
          desc: "Terminal PTY nguyên bản hỗ trợ bởi Rust và xterm.js. Chạy git status, pull, push, curl hoặc server backend trực tiếp mà không cần rời cửa sổ ứng dụng.",
        },
        generator: {
          title: "Trình Tạo Code Snippet Đa Ngôn Ngữ",
          desc: "Chuyển đổi mọi HTTP request thành mã client chỉ với 1 cú click: cURL, Fetch API, Python Requests, Rust Reqwest, Go net/http, Java OkHttp và HTTPie.",
        },
        autocomplete: {
          title: "Gợi Ý Biến Thông Minh",
          desc: "Gõ {{ ở bất kỳ đâu trong URL, Header, Auth hoặc Body để kích hoạt gợi ý biến thông minh với điều hướng bàn phím và xem trước giá trị tức thì.",
        },
        quickOpen: {
          title: "Mở Nhanh & Tìm Kiếm Tab",
          desc: "Nhấn Ctrl+Shift+A để tìm kiếm các tab đang mở theo phương thức/URL kèm chỉ báo chưa lưu, hoặc Ctrl+P để mở nhanh bất kỳ tệp yêu cầu nào.",
        },
      },
    },
    install: {
      badge: "Bắt đầu nhanh",
      title: "Cài Đặt Trên Linux Trong Vài Giây",
      description:
        "Chọn định dạng gói cài đặt ưa thích của bạn hoặc tự biên dịch trực tiếp từ mã nguồn.",
      channelLabel: "Kênh phát hành",
      channelStable: "Ổn định ({version})",
      channelBeta: "Beta ({version})",
      tabs: {
        deb: "Debian / Ubuntu (.deb)",
        rpm: "Fedora / RHEL (.rpm)",
        appimage: "Phổ quát (.AppImage)",
        source: "Biên dịch từ nguồn",
      },
      copy: "Sao chép",
      copied: "Đã sao chép!",
      terminalTitle: "bash — cài đặt",
      comments: {
        deb1: "# 1. Tải gói Debian/Ubuntu",
        deb2: "# 2. Cài đặt gói",
        deb3: "# tự động giải quyết các gói phụ thuộc còn thiếu",
        rpm1: "# 1. Tải gói Fedora/RHEL",
        rpm2: "# 2. Cài đặt bằng dnf hoặc rpm",
        appimage1: "# 1. Tải gói AppImage phổ quát",
        appimage2: "# 2. Cấp quyền thực thi và khởi chạy",
        source1: "# 1. Sao chép kho mã nguồn",
        source2: "# 2. Cài đặt các gói phụ thuộc & chạy máy chủ phát triển",
        source3: "# 3. Đóng gói bản phát hành",
      },
    },
    shortcuts: {
      badge: "Phím tắt nhanh",
      title: "Dành Cho Lập Trình Viên Chuyên Nghiệp",
      description:
        "Gửi yêu cầu, tìm kiếm tab, điều hướng workspace và đóng mở terminal nhanh chóng mà không cần dùng chuột.",
      items: {
        sendRequest: "Gửi yêu cầu hiện tại",
        saveRequest: "Lưu yêu cầu hiện tại",
        searchTabs: "Tìm kiếm các tab đang mở",
        quickOpen: "Mở nhanh yêu cầu / tệp",
        commandPalette: "Bảng lệnh nhanh (Command Palette)",
        toggleTerminal: "Bật / tắt bảng Terminal",
        closeTab: "Đóng tab đang chọn",
        openFolder: "Mở thư mục Workspace",
      },
    },
    footer: {
      brandSubtitle: "API Client thế hệ mới lưu trữ cục bộ và chuẩn Git.",
      github: "GitHub",
      releases: "Bản phát hành",
      docs: "Tài liệu hướng dẫn",
      license: "Giấy phép MIT",
      changelog: "Nhật ký thay đổi",
      credit: "Được phát triển với ♥ bởi",
      mitNote: "Phát hành theo Giấy phép MIT.",
    },
  },
};

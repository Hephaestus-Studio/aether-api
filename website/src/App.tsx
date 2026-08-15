import React, { useState } from "react";
import "./styles/landing.css";

const GITHUB_REPO = "https://github.com/Hephaestus-Studio/aether-api";
const LATEST_TAG = "v0.2.0-beta";
const RELEASE_BASE = `${GITHUB_REPO}/releases/download/${LATEST_TAG}`;

export default function App() {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [installTab, setInstallTab] = useState<"deb" | "rpm" | "appimage" | "source">("deb");
  const [copied, setCopied] = useState(false);

  const installSnippets = {
    deb: `# 1. Download Debian/Ubuntu package
wget ${RELEASE_BASE}/aether-api_0.2.0-beta_amd64.deb

# 2. Install package
sudo dpkg -i aether-api_0.2.0-beta_amd64.deb
sudo apt-get install -f # resolve any missing dependencies`,

    rpm: `# 1. Download Fedora/RHEL package
wget ${RELEASE_BASE}/aether-api-0.2.0-beta.x86_64.rpm

# 2. Install with dnf or rpm
sudo dnf install ./aether-api-0.2.0-beta.x86_64.rpm`,

    appimage: `# 1. Download Universal AppImage
wget ${RELEASE_BASE}/aether-api_0.2.0-beta_amd64.AppImage

# 2. Make executable and run
chmod +x aether-api_0.2.0-beta_amd64.AppImage
./aether-api_0.2.0-beta_amd64.AppImage`,

    source: `# 1. Clone repository
git clone https://github.com/Hephaestus-Studio/aether-api.git
cd aether-api

# 2. Install dependencies & run development server
pnpm install
pnpm tauri dev

# 3. Build release bundle
pnpm tauri build`,
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="landing-root">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* ==================================================================
          STICKY HEADER
          ================================================================== */}
      <header className="site-header">
        <div className="container nav-wrapper">
          <a href="#" className="brand-logo">
            <img src="./logo.svg" alt="Aether API Logo" />
            <span className="brand-name">
              AETHER <span className="brand-badge">API</span>
            </span>
          </a>

          <nav className="nav-links">
            <a href="#comparison">Why Aether</a>
            <a href="#features">Features</a>
            <a href="#installation">Download</a>
            <a href="#shortcuts">Shortcuts</a>
            <a href={`${GITHUB_REPO}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">
              Changelog
            </a>
          </nav>

          <div className="nav-actions">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="btn-github"
              title="Star on GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Star on GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* ==================================================================
          HERO SECTION
          ================================================================== */}
      <section className="hero-section">
        <div className="container">
          <a
            href={`${GITHUB_REPO}/releases/tag/${LATEST_TAG}`}
            target="_blank"
            rel="noreferrer"
            className="version-pill"
          >
            <span className="dot"></span>
            <span>Release {LATEST_TAG} is now available!</span>
            <span>&rarr;</span>
          </a>

          <h1 className="hero-title">
            Your APIs. Your Files. <br />
            <span className="hero-gradient-text">Your Control.</span>
          </h1>

          <p className="hero-subtitle">
            The modern, open-source API client that stores everything as plain YAML files in your
            Git repository. <strong>Zero telemetry</strong>, <strong>on-device encryption</strong>,
            and native <strong>Rust performance</strong>.
          </p>

          <div className="hero-cta-group">
            {/* Primary Download Dropdown */}
            <div className="download-dropdown-wrapper" onMouseLeave={() => setDownloadOpen(false)}>
              <button
                className="btn-primary-download"
                onClick={() => setDownloadOpen(!downloadOpen)}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Download for Linux</span>
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {downloadOpen && (
                <div className="download-dropdown-menu">
                  <a
                    href={`${RELEASE_BASE}/aether-api_0.2.0-beta_amd64.AppImage`}
                    className="download-item"
                  >
                    <span>Universal Linux</span>
                    <span className="ext">.AppImage</span>
                  </a>
                  <a
                    href={`${RELEASE_BASE}/aether-api_0.2.0-beta_amd64.deb`}
                    className="download-item"
                  >
                    <span>Debian / Ubuntu</span>
                    <span className="ext">.deb</span>
                  </a>
                  <a
                    href={`${RELEASE_BASE}/aether-api-0.2.0-beta.x86_64.rpm`}
                    className="download-item"
                  >
                    <span>Fedora / RHEL</span>
                    <span className="ext">.rpm</span>
                  </a>
                  <a
                    href={`${RELEASE_BASE}/SHA256SUMS`}
                    target="_blank"
                    rel="noreferrer"
                    className="download-item"
                  >
                    <span>GPG &amp; Checksums</span>
                    <span className="ext">SHA256</span>
                  </a>
                </div>
              )}
            </div>

            <a href="#comparison" className="btn-secondary">
              <span>Why Aether?</span>
              <span>&darr;</span>
            </a>
          </div>

          {/* Hero Banner Preview */}
          <div className="hero-banner-preview">
            <img src="./banner.svg" alt="Aether API Hero Banner" />
          </div>
        </div>
      </section>

      {/* ==================================================================
          COMPARISON MATRIX (THE CORE VALUE PROPOSITION)
          ================================================================== */}
      <section id="comparison" className="comparison-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Comparison</span>
            <h2 className="section-title">Built for Engineers Who Value Privacy &amp; Speed</h2>
            <p className="section-desc">
              Tired of vendor lock-in, mandatory cloud logins, and multi-gigabyte RAM usage? See how
              Aether API compares to traditional API clients.
            </p>
          </div>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th style={{ width: "38%" }}>Feature / Architecture</th>
                  <th className="col-aether" style={{ width: "32%" }}>
                    ⚡ Aether API (Local-First)
                  </th>
                  <th style={{ width: "30%" }}>Traditional Cloud Clients</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="feature-title-cell">
                    <strong>Storage &amp; Collaboration</strong>
                    <span>How collections and requests are stored and shared</span>
                  </td>
                  <td className="col-aether">
                    <div className="badge-check">
                      <span>✓</span>
                      <span>Plain YAML files in Git</span>
                    </div>
                  </td>
                  <td>
                    <div className="badge-cross">
                      <span>✗</span>
                      <span>Proprietary Cloud Sync</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td className="feature-title-cell">
                    <strong>Privacy &amp; Telemetry</strong>
                    <span>Whether your payloads, tokens, and data leave your device</span>
                  </td>
                  <td className="col-aether">
                    <div className="badge-check">
                      <span>✓</span>
                      <span>100% Zero Telemetry</span>
                    </div>
                  </td>
                  <td>
                    <div className="badge-cross">
                      <span>✗</span>
                      <span>Telemetry &amp; Tracking</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td className="feature-title-cell">
                    <strong>Secret Encryption</strong>
                    <span>Protection for API keys, passwords, and tokens</span>
                  </td>
                  <td className="col-aether">
                    <div className="badge-check">
                      <span>✓</span>
                      <span>AES-256-GCM On-Device</span>
                    </div>
                  </td>
                  <td>
                    <div className="badge-cross">
                      <span>✗</span>
                      <span>Stored on Cloud Servers</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td className="feature-title-cell">
                    <strong>Engine &amp; Memory Footprint</strong>
                    <span>Runtime performance and system resource consumption</span>
                  </td>
                  <td className="col-aether">
                    <div className="badge-check">
                      <span>✓</span>
                      <span>Tauri v2 + Rust Reqwest (&lt;80MB)</span>
                    </div>
                  </td>
                  <td>
                    <div className="badge-cross">
                      <span>✗</span>
                      <span>Heavy Electron (&gt;800MB RAM)</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td className="feature-title-cell">
                    <strong>Integrated Terminal</strong>
                    <span>Run git, curl, npm directly inside workspace</span>
                  </td>
                  <td className="col-aether">
                    <div className="badge-check">
                      <span>✓</span>
                      <span>Native Multi-Tab PTY Terminal</span>
                    </div>
                  </td>
                  <td>
                    <div className="badge-cross">
                      <span>✗</span>
                      <span>Not Available</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td className="feature-title-cell">
                    <strong>Git Workflow Integration</strong>
                    <span>Branching, Code Review, and Pull Requests</span>
                  </td>
                  <td className="col-aether">
                    <div className="badge-check">
                      <span>✓</span>
                      <span>Standard Git PRs &amp; Diffs</span>
                    </div>
                  </td>
                  <td>
                    <div className="badge-cross">
                      <span>✗</span>
                      <span>Paywalled Team Tiers</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ==================================================================
          DEEP-DIVE FEATURES GRID
          ================================================================== */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Capabilities</span>
            <h2 className="section-title">Engineered for Frictionless API Workflows</h2>
            <p className="section-desc">
              Every tool and UI interaction in Aether API was crafted to maximize developer velocity
              without compromising privacy.
            </p>
          </div>

          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon-box">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <h3>Git-Centric Workspaces</h3>
              <p>
                Workspaces are real directories on your disk. Requests and environments are saved as
                human-readable YAML files, ready for instant branch switches, merges, and code
                reviews.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-card">
              <div className="feature-icon-box">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3>AES-256 Secret Masking</h3>
              <p>
                Environment variables support secret masking with toggleable eye icons. Sensitive
                passwords and tokens are securely encrypted on-device using a master passphrase.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon-box">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3>Embedded Multi-Tab Terminal</h3>
              <p>
                Built-in native PTY terminal powered by Rust and xterm.js. Run git status, pull,
                push, curl, or backend dev servers without leaving your workspace window.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon-box">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <h3>Code Snippet Generator</h3>
              <p>
                Transform any HTTP request into production-ready client code with 1 click: cURL,
                Fetch API, Python Requests, Rust Reqwest, Go net/http, Java OkHttp, and HTTPie.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="feature-card">
              <div className="feature-icon-box">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3>Variable Autocomplete</h3>
              <p>
                Type <code>{"{{"}</code> anywhere in URLs, Headers, Auth, or Bodies to trigger smart
                variable autocomplete with keyboard navigation and instant value preview tooltips.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="feature-card">
              <div className="feature-icon-box">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3>Quick Open &amp; Tab Search</h3>
              <p>
                Press <code>Ctrl+Shift+A</code> to search open tabs by method or URL with dirty-dot
                indicators, or <code>Ctrl+P</code> to instantly open any request file in the
                workspace.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================
          INSTALLATION SECTION
          ================================================================== */}
      <section id="installation" className="install-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Get Started</span>
            <h2 className="section-title">Install on Linux in Seconds</h2>
            <p className="section-desc">
              Choose your preferred Linux package format or build directly from source.
            </p>
          </div>

          <div className="install-tabs-nav">
            <button
              className={`install-tab-btn ${installTab === "deb" ? "active" : ""}`}
              onClick={() => setInstallTab("deb")}
            >
              Debian / Ubuntu (.deb)
            </button>
            <button
              className={`install-tab-btn ${installTab === "rpm" ? "active" : ""}`}
              onClick={() => setInstallTab("rpm")}
            >
              Fedora / RHEL (.rpm)
            </button>
            <button
              className={`install-tab-btn ${installTab === "appimage" ? "active" : ""}`}
              onClick={() => setInstallTab("appimage")}
            >
              Universal (.AppImage)
            </button>
            <button
              className={`install-tab-btn ${installTab === "source" ? "active" : ""}`}
              onClick={() => setInstallTab("source")}
            >
              Build from Source
            </button>
          </div>

          <div className="terminal-box">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="terminal-dot red"></span>
                <span className="terminal-dot yellow"></span>
                <span className="terminal-dot green"></span>
              </div>
              <span className="terminal-title">bash — installation</span>
              <button
                className="btn-copy"
                onClick={() => handleCopyCode(installSnippets[installTab])}
              >
                {copied ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span style={{ color: "#10B981" }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="terminal-body">
              <code>{installSnippets[installTab]}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ==================================================================
          KEYBOARD SHORTCUTS SECTION
          ================================================================== */}
      <section id="shortcuts" className="shortcuts-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Power Tools</span>
            <h2 className="section-title">Built for Keyboard Power Users</h2>
            <p className="section-desc">
              Execute requests, search tabs, navigate workspace, and toggle terminals without
              touching the mouse.
            </p>
          </div>

          <div className="shortcuts-grid">
            <div className="shortcut-card">
              <span className="shortcut-label">Send Active Request</span>
              <kbd className="kbd">Ctrl + Enter</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">Save Current Request</span>
              <kbd className="kbd">Ctrl + S</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">Search Open Tabs</span>
              <kbd className="kbd">Ctrl + Shift + A</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">Quick Open Request / File</span>
              <kbd className="kbd">Ctrl + P</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">Command Palette</span>
              <kbd className="kbd">Ctrl + K</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">Toggle Terminal Panel</span>
              <kbd className="kbd">Ctrl + `</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">Close Active Tab</span>
              <kbd className="kbd">Ctrl + W</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">Open Workspace Folder</span>
              <kbd className="kbd">Ctrl + O</kbd>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================
          FOOTER
          ================================================================== */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h4>AETHER API</h4>
              <p>Next-Generation Local-First &amp; Git-Centric API Client.</p>
            </div>

            <ul className="footer-links">
              <li>
                <a href={GITHUB_REPO} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/releases`} target="_blank" rel="noreferrer">
                  Releases
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
                  MIT License
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">
                  Changelog
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-bottom">
            <p>
              Built with &hearts; by <strong>Hephaestus Studio</strong>. Released under the MIT
              License.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

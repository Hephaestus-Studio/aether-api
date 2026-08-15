import React, { useState, useEffect } from "react";
import { Language, translations } from "./i18n/translations";
import "./styles/landing.css";

const GITHUB_REPO = "https://github.com/Hephaestus-Studio/aether-api";
const LATEST_TAG = "v0.2.0-beta.2";
const RAW_VERSION = "0.2.0-beta.2";
const RELEASE_BASE = `${GITHUB_REPO}/releases/download/${LATEST_TAG}`;

export default function App() {
  // Initialize language from localStorage (defaults to English "en")
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("aether_lang");
      if (saved === "en" || saved === "vi") return saved;
    } catch {
      // Fallback
    }
    return "en";
  });

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [installTab, setInstallTab] = useState<"deb" | "rpm" | "appimage" | "source">("deb");
  const [copied, setCopied] = useState(false);

  // Live GitHub star count
  const [starCount, setStarCount] = useState<number | null>(() => {
    try {
      const cached = sessionStorage.getItem("aether_github_stars");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 1000 * 60 * 10) {
          return parsed.stars;
        }
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const t = translations[lang];

  // Fetch live star count from GitHub API
  useEffect(() => {
    if (starCount !== null) return;
    fetch("https://api.github.com/repos/Hephaestus-Studio/aether-api")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch star count");
        return res.json();
      })
      .then((data) => {
        if (typeof data.stargazers_count === "number") {
          setStarCount(data.stargazers_count);
          try {
            sessionStorage.setItem(
              "aether_github_stars",
              JSON.stringify({ stars: data.stargazers_count, timestamp: Date.now() })
            );
          } catch {
            // Ignore
          }
        }
      })
      .catch(() => {
        // Fallback silently if offline or rate-limited
      });
  }, [starCount]);

  const formatStars = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return count.toString();
  };

  // Save language changes and update DOM attributes
  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem("aether_lang", newLang);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === "vi") {
      document.title = "Aether API | API Client Chuẩn Git & Cục Bộ Thế Hệ Mới";
    } else {
      document.title = "Aether API | Next-Gen Local-First & Git-Centric API Client";
    }
  }, [lang]);

  // Lock body & html scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.documentElement.classList.add("menu-open");
      document.body.classList.add("menu-open");
    } else {
      document.documentElement.classList.remove("menu-open");
      document.body.classList.remove("menu-open");
    }
    return () => {
      document.documentElement.classList.remove("menu-open");
      document.body.classList.remove("menu-open");
    };
  }, [mobileMenuOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (downloadOpen && !target?.closest(".download-dropdown-wrapper")) {
        setDownloadOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [downloadOpen]);

  const installSnippets = {
    deb: `${t.install.comments.deb1}
wget ${RELEASE_BASE}/Aether.API_${RAW_VERSION}_amd64.deb

${t.install.comments.deb2}
sudo dpkg -i Aether.API_${RAW_VERSION}_amd64.deb
sudo apt-get install -f ${t.install.comments.deb3}`,

    rpm: `${t.install.comments.rpm1}
wget ${RELEASE_BASE}/Aether.API-${RAW_VERSION}-1.x86_64.rpm

${t.install.comments.rpm2}
sudo dnf install ./Aether.API-${RAW_VERSION}-1.x86_64.rpm`,

    appimage: `${t.install.comments.appimage1}
wget ${RELEASE_BASE}/Aether.API_${RAW_VERSION}_amd64.AppImage

${t.install.comments.appimage2}
chmod +x Aether.API_${RAW_VERSION}_amd64.AppImage
./Aether.API_${RAW_VERSION}_amd64.AppImage`,

    source: `${t.install.comments.source1}
git clone https://github.com/Hephaestus-Studio/aether-api.git
cd aether-api

${t.install.comments.source2}
pnpm install
pnpm tauri dev

${t.install.comments.source3}
pnpm tauri build`,
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="landing-root">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* ==================================================================
          STICKY HEADER
          ================================================================== */}
      <header className="site-header">
        <div className="container nav-wrapper">
          <a href="#" className="brand-logo" onClick={closeMobileMenu}>
            <img src="./logo.svg" alt="Aether API Logo" />
            <span className="brand-name">
              AETHER <span className="brand-badge">API</span>
            </span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="nav-links">
            <a href="#comparison">{t.nav.whyAether}</a>
            <a href="#features">{t.nav.features}</a>
            <a href="#installation">{t.nav.download}</a>
            <a href="#shortcuts">{t.nav.shortcuts}</a>
            <a href={`${GITHUB_REPO}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">
              {t.nav.changelog}
            </a>
          </nav>

          {/* Header Actions */}
          <div className="nav-actions">
            {/* Language Switcher Segmented Control */}
            <div className="lang-switcher" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => handleLanguageChange("en")}
                aria-pressed={lang === "en"}
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === "vi" ? "active" : ""}`}
                onClick={() => handleLanguageChange("vi")}
                aria-pressed={lang === "vi"}
              >
                VI
              </button>
            </div>

            {/* Desktop GitHub Star Button */}
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
              <span className="btn-github-text">{t.nav.starGitHub}</span>
              {starCount !== null && (
                <span className="github-star-badge" aria-label={`${starCount} GitHub stars`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="star-icon">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span>{formatStars(starCount)}</span>
                </span>
              )}
            </a>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              type="button"
              className={`btn-hamburger ${mobileMenuOpen ? "open" : ""}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t.nav.close : t.nav.menu}
              aria-expanded={mobileMenuOpen}
            >
              <span className="hamburger-bar"></span>
              <span className="hamburger-bar"></span>
              <span className="hamburger-bar"></span>
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================
          MOBILE NAVIGATION DRAWER & BACKDROP
          ================================================================== */}
      <div
        className={`mobile-backdrop ${mobileMenuOpen ? "open" : ""}`}
        onClick={closeMobileMenu}
      ></div>

      <nav className={`mobile-nav-drawer ${mobileMenuOpen ? "open" : ""}`}>
        <div className="mobile-nav-content">
          <div className="mobile-nav-links">
            <a href="#comparison" onClick={closeMobileMenu}>
              <span className="mobile-link-icon">⚡</span>
              <span className="mobile-link-text">{t.nav.whyAether}</span>
              <span className="mobile-link-arrow">→</span>
            </a>
            <a href="#features" onClick={closeMobileMenu}>
              <span className="mobile-link-icon">✨</span>
              <span className="mobile-link-text">{t.nav.features}</span>
              <span className="mobile-link-arrow">→</span>
            </a>
            <a href="#installation" onClick={closeMobileMenu}>
              <span className="mobile-link-icon">📥</span>
              <span className="mobile-link-text">{t.nav.download}</span>
              <span className="mobile-link-arrow">→</span>
            </a>
            <a href="#shortcuts" onClick={closeMobileMenu}>
              <span className="mobile-link-icon">⌨️</span>
              <span className="mobile-link-text">{t.nav.shortcuts}</span>
              <span className="mobile-link-arrow">→</span>
            </a>
            <a
              href={`${GITHUB_REPO}/blob/main/CHANGELOG.md`}
              target="_blank"
              rel="noreferrer"
              onClick={closeMobileMenu}
            >
              <span className="mobile-link-icon">📝</span>
              <span className="mobile-link-text">{t.nav.changelog}</span>
              <span className="mobile-link-arrow">↗</span>
            </a>
          </div>

          <div className="mobile-nav-footer">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="btn-mobile-github"
              onClick={closeMobileMenu}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>{t.nav.starGitHub}</span>
              {starCount !== null && (
                <span className="github-star-badge mobile" aria-label={`${starCount} GitHub stars`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="star-icon">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span>{formatStars(starCount)}</span>
                </span>
              )}
            </a>
            <div className="mobile-drawer-badge">
              <span className="dot"></span>
              <span>Aether API {LATEST_TAG}</span>
            </div>
          </div>
        </div>
      </nav>

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
            <span>{t.hero.releaseBadge.replace("{version}", LATEST_TAG)}</span>
            <span>→</span>
          </a>

          <h1 className="hero-title">
            {t.hero.titleLine1} <br />
            <span className="hero-gradient-text">{t.hero.titleHighlight}</span>
          </h1>

          <p className="hero-subtitle">{t.hero.subtitle}</p>

          <div className="hero-cta-group">
            {/* Primary Download Dropdown */}
            <div className="download-dropdown-wrapper">
              <button
                type="button"
                className="btn-primary-download"
                onClick={() => setDownloadOpen(!downloadOpen)}
                aria-expanded={downloadOpen}
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
                <span>{t.hero.downloadLinux}</span>
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  className={`dropdown-chevron ${downloadOpen ? "open" : ""}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {downloadOpen && (
                <div className="download-dropdown-menu">
                  <a
                    href={`${RELEASE_BASE}/Aether.API_${RAW_VERSION}_amd64.AppImage`}
                    className="download-item"
                    onClick={() => setDownloadOpen(false)}
                  >
                    <span>{t.hero.downloads.universal}</span>
                    <span className="ext">.AppImage</span>
                  </a>
                  <a
                    href={`${RELEASE_BASE}/Aether.API_${RAW_VERSION}_amd64.deb`}
                    className="download-item"
                    onClick={() => setDownloadOpen(false)}
                  >
                    <span>{t.hero.downloads.debian}</span>
                    <span className="ext">.deb</span>
                  </a>
                  <a
                    href={`${RELEASE_BASE}/Aether.API-${RAW_VERSION}-1.x86_64.rpm`}
                    className="download-item"
                    onClick={() => setDownloadOpen(false)}
                  >
                    <span>{t.hero.downloads.fedora}</span>
                    <span className="ext">.rpm</span>
                  </a>
                  <a
                    href={`${RELEASE_BASE}/SHA256SUMS`}
                    target="_blank"
                    rel="noreferrer"
                    className="download-item"
                    onClick={() => setDownloadOpen(false)}
                  >
                    <span>{t.hero.downloads.checksums}</span>
                    <span className="ext">SHA256</span>
                  </a>
                </div>
              )}
            </div>

            <a href="#comparison" className="btn-secondary">
              <span>{t.hero.whyAetherBtn}</span>
              <span>↓</span>
            </a>
          </div>

          {/* Hero Banner Preview */}
          <div className="hero-banner-preview">
            <img
              src="./banner.svg"
              alt="Aether API Hero Banner"
              loading="eager"
              width="1200"
              height="600"
            />
          </div>
        </div>
      </section>

      {/* ==================================================================
          COMPARISON MATRIX (THE CORE VALUE PROPOSITION)
          ================================================================== */}
      <section id="comparison" className="comparison-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">{t.comparison.badge}</span>
            <h2 className="section-title">{t.comparison.title}</h2>
            <p className="section-desc">{t.comparison.description}</p>
          </div>

          {/* Responsive Comparison Table with Scroll Wrapper for Desktop/Tablet */}
          <div className="comparison-table-wrapper">
            <div className="comparison-scroll-container">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th style={{ width: "38%" }}>{t.comparison.tableHeaders.feature}</th>
                    <th className="col-aether" style={{ width: "32%" }}>
                      {t.comparison.tableHeaders.aether}
                    </th>
                    <th style={{ width: "30%" }}>{t.comparison.tableHeaders.traditional}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="feature-title-cell">
                      <strong>{t.comparison.rows.storage.title}</strong>
                      <span>{t.comparison.rows.storage.desc}</span>
                    </td>
                    <td className="col-aether">
                      <div className="badge-check">
                        <span>✓</span>
                        <span>{t.comparison.rows.storage.aether}</span>
                      </div>
                    </td>
                    <td>
                      <div className="badge-cross">
                        <span>✗</span>
                        <span>{t.comparison.rows.storage.traditional}</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-title-cell">
                      <strong>{t.comparison.rows.privacy.title}</strong>
                      <span>{t.comparison.rows.privacy.desc}</span>
                    </td>
                    <td className="col-aether">
                      <div className="badge-check">
                        <span>✓</span>
                        <span>{t.comparison.rows.privacy.aether}</span>
                      </div>
                    </td>
                    <td>
                      <div className="badge-cross">
                        <span>✗</span>
                        <span>{t.comparison.rows.privacy.traditional}</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-title-cell">
                      <strong>{t.comparison.rows.encryption.title}</strong>
                      <span>{t.comparison.rows.encryption.desc}</span>
                    </td>
                    <td className="col-aether">
                      <div className="badge-check">
                        <span>✓</span>
                        <span>{t.comparison.rows.encryption.aether}</span>
                      </div>
                    </td>
                    <td>
                      <div className="badge-cross">
                        <span>✗</span>
                        <span>{t.comparison.rows.encryption.traditional}</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-title-cell">
                      <strong>{t.comparison.rows.engine.title}</strong>
                      <span>{t.comparison.rows.engine.desc}</span>
                    </td>
                    <td className="col-aether">
                      <div className="badge-check">
                        <span>✓</span>
                        <span>{t.comparison.rows.engine.aether}</span>
                      </div>
                    </td>
                    <td>
                      <div className="badge-cross">
                        <span>✗</span>
                        <span>{t.comparison.rows.engine.traditional}</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-title-cell">
                      <strong>{t.comparison.rows.terminal.title}</strong>
                      <span>{t.comparison.rows.terminal.desc}</span>
                    </td>
                    <td className="col-aether">
                      <div className="badge-check">
                        <span>✓</span>
                        <span>{t.comparison.rows.terminal.aether}</span>
                      </div>
                    </td>
                    <td>
                      <div className="badge-cross">
                        <span>✗</span>
                        <span>{t.comparison.rows.terminal.traditional}</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-title-cell">
                      <strong>{t.comparison.rows.gitWorkflow.title}</strong>
                      <span>{t.comparison.rows.gitWorkflow.desc}</span>
                    </td>
                    <td className="col-aether">
                      <div className="badge-check">
                        <span>✓</span>
                        <span>{t.comparison.rows.gitWorkflow.aether}</span>
                      </div>
                    </td>
                    <td>
                      <div className="badge-cross">
                        <span>✗</span>
                        <span>{t.comparison.rows.gitWorkflow.traditional}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Optimized Comparison Cards for Small Phones */}
          <div className="comparison-cards-mobile">
            {Object.entries(t.comparison.rows).map(([key, item]) => (
              <div key={key} className="comparison-card-item">
                <div className="comp-card-header">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
                <div className="comp-card-body">
                  <div className="comp-card-side aether">
                    <span className="side-tag">Aether API</span>
                    <div className="badge-check">
                      <span>✓</span>
                      <span>{item.aether}</span>
                    </div>
                  </div>
                  <div className="comp-card-side traditional">
                    <span className="side-tag">Traditional</span>
                    <div className="badge-cross">
                      <span>✗</span>
                      <span>{item.traditional}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================
          DEEP-DIVE FEATURES GRID
          ================================================================== */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">{t.features.badge}</span>
            <h2 className="section-title">{t.features.title}</h2>
            <p className="section-desc">{t.features.description}</p>
          </div>

          <div className="features-grid">
            {/* Feature 1: Git-Centric */}
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
              <h3>{t.features.items.git.title}</h3>
              <p>{t.features.items.git.desc}</p>
            </div>

            {/* Feature 2: Secret Masking */}
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
              <h3>{t.features.items.security.title}</h3>
              <p>{t.features.items.security.desc}</p>
            </div>

            {/* Feature 3: Embedded Terminal */}
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
              <h3>{t.features.items.terminal.title}</h3>
              <p>{t.features.items.terminal.desc}</p>
            </div>

            {/* Feature 4: Code Snippet Generator */}
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
              <h3>{t.features.items.generator.title}</h3>
              <p>{t.features.items.generator.desc}</p>
            </div>

            {/* Feature 5: Variable Autocomplete */}
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
              <h3>{t.features.items.autocomplete.title}</h3>
              <p>{t.features.items.autocomplete.desc}</p>
            </div>

            {/* Feature 6: Quick Open */}
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
              <h3>{t.features.items.quickOpen.title}</h3>
              <p>{t.features.items.quickOpen.desc}</p>
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
            <span className="section-badge">{t.install.badge}</span>
            <h2 className="section-title">{t.install.title}</h2>
            <p className="section-desc">{t.install.description}</p>
          </div>

          <div className="install-tabs-nav">
            <button
              type="button"
              className={`install-tab-btn ${installTab === "deb" ? "active" : ""}`}
              onClick={() => setInstallTab("deb")}
            >
              {t.install.tabs.deb}
            </button>
            <button
              type="button"
              className={`install-tab-btn ${installTab === "rpm" ? "active" : ""}`}
              onClick={() => setInstallTab("rpm")}
            >
              {t.install.tabs.rpm}
            </button>
            <button
              type="button"
              className={`install-tab-btn ${installTab === "appimage" ? "active" : ""}`}
              onClick={() => setInstallTab("appimage")}
            >
              {t.install.tabs.appimage}
            </button>
            <button
              type="button"
              className={`install-tab-btn ${installTab === "source" ? "active" : ""}`}
              onClick={() => setInstallTab("source")}
            >
              {t.install.tabs.source}
            </button>
          </div>

          <div className="terminal-box">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="terminal-dot red"></span>
                <span className="terminal-dot yellow"></span>
                <span className="terminal-dot green"></span>
              </div>
              <span className="terminal-title">{t.install.terminalTitle}</span>
              <button
                type="button"
                className="btn-copy"
                onClick={() => handleCopyCode(installSnippets[installTab])}
                aria-label={copied ? t.install.copied : t.install.copy}
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
                    <span style={{ color: "#10B981" }}>{t.install.copied}</span>
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
                    <span>{t.install.copy}</span>
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
            <span className="section-badge">{t.shortcuts.badge}</span>
            <h2 className="section-title">{t.shortcuts.title}</h2>
            <p className="section-desc">{t.shortcuts.description}</p>
          </div>

          <div className="shortcuts-grid">
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.sendRequest}</span>
              <kbd className="kbd">Ctrl + Enter</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.saveRequest}</span>
              <kbd className="kbd">Ctrl + S</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.searchTabs}</span>
              <kbd className="kbd">Ctrl + Shift + A</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.quickOpen}</span>
              <kbd className="kbd">Ctrl + P</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.commandPalette}</span>
              <kbd className="kbd">Ctrl + K</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.toggleTerminal}</span>
              <kbd className="kbd">Ctrl + `</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.closeTab}</span>
              <kbd className="kbd">Ctrl + W</kbd>
            </div>
            <div className="shortcut-card">
              <span className="shortcut-label">{t.shortcuts.items.openFolder}</span>
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
              <p>{t.footer.brandSubtitle}</p>
            </div>

            <ul className="footer-links">
              <li>
                <a href={GITHUB_REPO} target="_blank" rel="noreferrer" className="footer-github-link">
                  <span>{t.footer.github}</span>
                  {starCount !== null && (
                    <span className="footer-star-pill">
                      ★ {formatStars(starCount)}
                    </span>
                  )}
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/releases`} target="_blank" rel="noreferrer">
                  {t.footer.releases}
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
                  {t.footer.license}
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">
                  {t.footer.changelog}
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-bottom">
            <p>
              {t.footer.credit} <strong>Hephaestus Studio</strong>. {t.footer.mitNote}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import { marked } from "marked";
import { Language } from "../i18n/translations";
import { DOC_CATEGORIES, DOC_ARTICLES, getArticleById } from "./docsData";
import { DocsSidebar } from "./DocsSidebar";
import { DocsTOC } from "./DocsTOC";
import { DocsSearchModal } from "./DocsSearchModal";
import "../styles/docs.css";

interface DocsViewProps {
  articleId: string;
  onNavigateArticle: (articleId: string) => void;
  onBackToHome: () => void;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  starCount: number | null;
  formatStars: (count: number) => string;
}

export const DocsView: React.FC<DocsViewProps> = ({
  articleId,
  onNavigateArticle,
  onBackToHome,
  lang,
  onLanguageChange,
  starCount,
  formatStars,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const article = getArticleById(articleId);
  const category = DOC_CATEGORIES.find((c) => c.id === article.category);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
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
  }, [mobileSidebarOpen]);

  // Scroll to top on article change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [articleId]);

  // Determine previous and next articles for pagination
  const { prevArticle, nextArticle } = useMemo(() => {
    const allArticleIds = DOC_CATEGORIES.flatMap((c) => c.articleIds);
    const currentIndex = allArticleIds.indexOf(article.id);

    const prevId = currentIndex > 0 ? allArticleIds[currentIndex - 1] : null;
    const nextId = currentIndex < allArticleIds.length - 1 ? allArticleIds[currentIndex + 1] : null;

    return {
      prevArticle: prevId ? DOC_ARTICLES[prevId] : null,
      nextArticle: nextId ? DOC_ARTICLES[nextId] : null,
    };
  }, [article.id]);

  // Convert markdown content to HTML and enrich with custom Alerts
  const renderedContent = useMemo(() => {
    let raw = article.content[lang] || "";

    // Replace GitHub alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING]
    raw = raw.replace(
      /> \[!NOTE\]\n> (.*)/g,
      '<div class="docs-alert alert-note"><div class="alert-icon">ℹ️</div><div class="alert-content"><strong>NOTE:</strong> $1</div></div>',
    );
    raw = raw.replace(
      /> \[!TIP\]\n> (.*)/g,
      '<div class="docs-alert alert-tip"><div class="alert-icon">💡</div><div class="alert-content"><strong>TIP:</strong> $1</div></div>',
    );
    raw = raw.replace(
      /> \[!IMPORTANT\]\n> (.*)/g,
      '<div class="docs-alert alert-important"><div class="alert-icon">⚠️</div><div class="alert-content"><strong>IMPORTANT:</strong> $1</div></div>',
    );
    raw = raw.replace(
      /> \[!WARNING\]\n> (.*)/g,
      '<div class="docs-alert alert-warning"><div class="alert-icon">🛑</div><div class="alert-content"><strong>WARNING:</strong> $1</div></div>',
    );

    try {
      return marked.parse(raw) as string;
    } catch {
      return raw;
    }
  }, [article, lang]);

  // Code block copy helper
  useEffect(() => {
    const preBlocks = document.querySelectorAll<HTMLPreElement>(".docs-article-body pre");
    preBlocks.forEach((pre, index) => {
      if (pre.querySelector(".docs-copy-btn")) return;

      const button = document.createElement("button");
      button.className = "docs-copy-btn";
      button.setAttribute("aria-label", "Copy code");
      button.innerHTML = `
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <span>Copy</span>
      `;

      button.addEventListener("click", () => {
        const code = pre.querySelector("code")?.innerText || pre.innerText;
        navigator.clipboard.writeText(code);
        button.innerHTML = `
          <svg width="14" height="14" fill="none" stroke="#10B981" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          <span style="color: #10B981">Copied!</span>
        `;
        setCopiedCodeIndex(index);
        setTimeout(() => {
          button.innerHTML = `
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            <span>Copy</span>
          `;
          setCopiedCodeIndex(null);
        }, 2000);
      });

      pre.style.position = "relative";
      pre.appendChild(button);
    });
  }, [renderedContent]);

  return (
    <div className="docs-page-layout">
      {/* Docs Header Navbar */}
      <header className="docs-header">
        <div className="docs-header-inner">
          <div className="docs-header-left">
            <button
              type="button"
              className="docs-mobile-menu-toggle"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle Docs Navigation"
            >
              <svg
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <button type="button" className="docs-brand" onClick={onBackToHome}>
              <img src="./logo.svg" alt="Aether Logo" width="28" height="28" />
              <span className="brand-name">Aether API</span>
              <span className="docs-badge">Docs</span>
            </button>
          </div>

          <div className="docs-header-center">
            <button
              type="button"
              className="docs-search-bar-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <svg
                width="16"
                height="16"
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
              <span>{lang === "vi" ? "Tìm kiếm tài liệu..." : "Search documentation..."}</span>
              <kbd>Ctrl K</kbd>
            </button>
          </div>

          <div className="docs-header-right">
            {/* Back to Home Link */}
            <button type="button" className="docs-home-link" onClick={onBackToHome}>
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span>{lang === "vi" ? "Trang chủ" : "Home"}</span>
            </button>

            {/* Language Switcher */}
            <div className="lang-switcher" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => onLanguageChange("en")}
                aria-pressed={lang === "en"}
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === "vi" ? "active" : ""}`}
                onClick={() => onLanguageChange("vi")}
                aria-pressed={lang === "vi"}
              >
                VI
              </button>
            </div>

            {/* GitHub Star Button */}
            <a
              href="https://github.com/Hephaestus-Studio/aether-api"
              target="_blank"
              rel="noreferrer"
              className="docs-github-btn"
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {starCount !== null && <span className="star-badge">★ {formatStars(starCount)}</span>}
            </a>
          </div>
        </div>
      </header>

      {/* Docs Main Content Body (3-Column Layout) */}
      <div className="docs-body-container">
        {/* 1. Left Sidebar */}
        <DocsSidebar
          activeArticleId={article.id}
          onSelectArticle={onNavigateArticle}
          lang={lang}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/* 2. Main Article Body */}
        <main className="docs-main-article">
          <div className="docs-article-wrapper">
            {/* Breadcrumbs */}
            <div className="docs-breadcrumbs">
              <span className="crumb-root" onClick={onBackToHome}>
                Docs
              </span>
              <span className="crumb-sep">/</span>
              <span className="crumb-category">{category?.title[lang]}</span>
              <span className="crumb-sep">/</span>
              <span className="crumb-active">{article.title[lang]}</span>
            </div>

            {/* Article Header */}
            <header className="docs-article-header">
              <h1 className="docs-article-title">{article.title[lang]}</h1>
              <p className="docs-article-lead">{article.description[lang]}</p>
              <div className="docs-article-meta">
                <span className="meta-read-time">⏱️ {article.readTime}</span>
                <span className="meta-sep">•</span>
                <span className="meta-tags">
                  {article.tags.map((tag) => (
                    <span key={tag} className="doc-tag">
                      #{tag}
                    </span>
                  ))}
                </span>
              </div>
            </header>

            {/* Rendered HTML Content */}
            <article
              className="docs-article-body"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />

            {/* Article Pagination (Previous / Next) */}
            <div className="docs-pagination-footer">
              {prevArticle ? (
                <button
                  type="button"
                  className="pagination-btn prev"
                  onClick={() => onNavigateArticle(prevArticle.id)}
                >
                  <span className="direction-label">
                    ← {lang === "vi" ? "Bài trước" : "Previous"}
                  </span>
                  <span className="pagination-title">{prevArticle.title[lang]}</span>
                </button>
              ) : (
                <div />
              )}

              {nextArticle && (
                <button
                  type="button"
                  className="pagination-btn next"
                  onClick={() => onNavigateArticle(nextArticle.id)}
                >
                  <span className="direction-label">
                    {lang === "vi" ? "Bài tiếp theo" : "Next"} →
                  </span>
                  <span className="pagination-title">{nextArticle.title[lang]}</span>
                </button>
              )}
            </div>
          </div>
        </main>

        {/* 3. Right Table of Contents */}
        <DocsTOC headings={article.headings[lang] || []} lang={lang} />
      </div>

      {/* Quick Search Modal (Ctrl+K) */}
      <DocsSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectArticle={onNavigateArticle}
        lang={lang}
      />
    </div>
  );
};

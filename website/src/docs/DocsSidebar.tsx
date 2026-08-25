import React from "react";
import { DOC_CATEGORIES, DOC_ARTICLES } from "./docsData";
import { Language } from "../i18n/translations";

interface DocsSidebarProps {
  activeArticleId: string;
  onSelectArticle: (articleId: string) => void;
  lang: Language;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
}

export const DocsSidebar: React.FC<DocsSidebarProps> = ({
  activeArticleId,
  onSelectArticle,
  lang,
  mobileOpen,
  onCloseMobile,
  onOpenSearch,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && <div className="docs-sidebar-backdrop" onClick={onCloseMobile} />}

      <aside className={`docs-sidebar-container ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Mobile Header with Close Button */}
        <div className="docs-sidebar-mobile-header">
          <div className="mobile-header-title">
            <span>{lang === "vi" ? "Mục lục tài liệu" : "Documentation"}</span>
          </div>
          <button
            type="button"
            className="docs-sidebar-close-btn"
            onClick={onCloseMobile}
            aria-label="Close Docs Navigation"
          >
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Search trigger button in sidebar */}
        <div className="docs-sidebar-search-wrapper">
          <button type="button" className="docs-sidebar-search-btn" onClick={onOpenSearch}>
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
            <span className="search-btn-label">
              {lang === "vi" ? "Tìm tài liệu..." : "Search docs..."}
            </span>
            <kbd className="search-kbd">Ctrl K</kbd>
          </button>
        </div>

        <nav className="docs-sidebar-nav">
          {DOC_CATEGORIES.map((category) => (
            <div key={category.id} className="docs-category-group">
              <div className="docs-category-header">
                <span className="category-title">{category.title[lang]}</span>
              </div>
              <ul className="docs-article-list">
                {category.articleIds.map((articleId) => {
                  const article = DOC_ARTICLES[articleId];
                  if (!article) return null;
                  const isActive = activeArticleId === articleId;

                  return (
                    <li key={articleId} className="docs-article-item">
                      <button
                        type="button"
                        className={`docs-article-link ${isActive ? "active" : ""}`}
                        onClick={() => {
                          onSelectArticle(articleId);
                          onCloseMobile();
                        }}
                      >
                        <span className="article-title">{article.title[lang]}</span>
                        {isActive && <span className="active-pill-indicator" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};

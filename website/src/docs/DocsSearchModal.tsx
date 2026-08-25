import React, { useState, useEffect, useRef } from "react";
import { searchDocs } from "./docsData";
import { Language } from "../i18n/translations";

interface DocsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArticle: (articleId: string) => void;
  lang: Language;
}

export const DocsSearchModal: React.FC<DocsSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectArticle,
  lang,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = searchDocs(query, lang);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation inside search modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length ? (prev - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        onSelectArticle(selected.articleId);
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="docs-search-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="docs-search-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="docs-search-header">
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            className="search-input-icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="docs-search-input"
            placeholder={
              lang === "vi"
                ? "Tìm kiếm tài liệu... (gõ 'yaml', 'git', 'aes')..."
                : "Search documentation... (type 'yaml', 'git', 'aes')..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="docs-search-esc-badge" onClick={onClose}>
            ESC
          </button>
        </div>

        <div className="docs-search-results">
          {query.trim() === "" ? (
            <div className="docs-search-empty-state">
              <span>
                {lang === "vi"
                  ? "Nhập từ khóa để tìm kiếm nhanh bài viết và hướng dẫn"
                  : "Type keywords to search across articles and guides"}
              </span>
            </div>
          ) : results.length === 0 ? (
            <div className="docs-search-no-results">
              <span>
                {lang === "vi"
                  ? "Không tìm thấy tài liệu phù hợp"
                  : "No matching documentation found"}
              </span>
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.articleId}
                className={`docs-search-item ${idx === selectedIndex ? "active" : ""}`}
                onClick={() => {
                  onSelectArticle(item.articleId);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="search-item-meta">
                  <span className="search-item-cat">{item.category}</span>
                  <span className="search-item-title">{item.title}</span>
                </div>
                <p className="search-item-desc">{item.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

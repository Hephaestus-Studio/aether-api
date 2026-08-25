import React, { useState, useEffect } from "react";
import { DocHeading } from "./types";
import { Language } from "../i18n/translations";

interface DocsTOCProps {
  headings: DocHeading[];
  lang: Language;
}

export const DocsTOC: React.FC<DocsTOCProps> = ({ headings, lang }) => {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!headings.length) return;
    setActiveId(headings[0].id);

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const headingElements = headings
        .map((h) => ({ id: h.id, el: document.getElementById(h.id) }))
        .filter((h): h is { id: string; el: HTMLElement } => Boolean(h.el));

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const item = headingElements[i];
        const offsetTop = item.el.getBoundingClientRect().top + scrollY - 120;
        if (scrollY >= offsetTop) {
          setActiveId(item.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  if (!headings.length) return null;

  return (
    <aside className="docs-toc-container">
      <div className="docs-toc-sticky">
        <h4 className="docs-toc-title">
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            className="toc-icon"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h14" />
          </svg>
          <span>{lang === "vi" ? "Nội dung bài viết" : "On this page"}</span>
        </h4>
        <nav className="docs-toc-nav">
          {headings.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`docs-toc-link level-${h.level} ${activeId === h.id ? "active" : ""}`}
              onClick={() => scrollToHeading(h.id)}
            >
              {h.text}
            </button>
          ))}
        </nav>

        <div className="docs-toc-footer">
          <a
            href="https://github.com/Hephaestus-Studio/aether-api/issues"
            target="_blank"
            rel="noreferrer"
            className="docs-feedback-link"
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.61 8.21 11.17.6.11.82-.26.82-.57v-2.02c-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.21.08 1.85 1.22 1.85 1.22 1.07 1.8 2.81 1.28 3.5 1 .11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.13-.3-.54-1.5.12-3.13 0 0 1.01-.32 3.3 1.21a11.66 11.66 0 016 0c2.29-1.53 3.3-1.21 3.3-1.21.66 1.63.25 2.83.12 3.13.78.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.82 1.1.82 2.22v3.29c0 .31.22.69.83.57 4.77-1.56 8.2-5.97 8.2-11.17C24 5.78 18.63.5 12 .5z" />
            </svg>
            <span>{lang === "vi" ? "Góp ý trên GitHub" : "Give feedback on GitHub"}</span>
          </a>
        </div>
      </div>
    </aside>
  );
};

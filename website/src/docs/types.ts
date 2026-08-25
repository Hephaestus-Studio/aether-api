export interface DocHeading {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3
}

export interface DocArticle {
  id: string; // e.g. "overview", "installation", "yaml-schema"
  title: {
    en: string;
    vi: string;
  };
  description: {
    en: string;
    vi: string;
  };
  category: string; // category id
  readTime: string; // e.g. "4 min read"
  tags: string[];
  headings: {
    en: DocHeading[];
    vi: DocHeading[];
  };
  content: {
    en: string; // Markdown / HTML formatted string
    vi: string;
  };
}

export interface DocCategory {
  id: string;
  title: {
    en: string;
    vi: string;
  };
  icon: string; // icon identifier or svg path
  articleIds: string[];
}

export interface DocSearchResult {
  articleId: string;
  title: string;
  category: string;
  description: string;
  matchedText?: string;
}

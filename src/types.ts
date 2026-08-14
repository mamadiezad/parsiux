export type Severity = "error" | "warning" | "info";

export type Product = {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  goal: string;
  sections: string[];
  components: string[];
  style: string;
  colors: Record<string, string>;
  font: {
    family: string;
    fallback: string;
    headingWeight: number;
    bodyWeight: number;
    lineHeight: number;
  };
  copyRules: string[];
  antiPatterns: string[];
  auditHints: string[];
};

export type Catalog = {
  version: string;
  products: Product[];
  rtlRules: Array<{ id: string; title: string; severity: Severity; rule: string; fix: string }>;
};

export type SearchHit = {
  product: Product;
  score: number;
  matchedTerms: string[];
};

export type Finding = {
  id: string;
  severity: Severity;
  file?: string;
  line?: number;
  title: string;
  detail: string;
  fix: string;
};

export type AuditReport = {
  target: string;
  scannedFiles: number;
  score: number;
  findings: Finding[];
  summary: Record<Severity, number>;
};

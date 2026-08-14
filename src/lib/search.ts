import { expandQuery, tokenize } from "./normalize.js";
import type { Product, SearchHit } from "../types.js";

export class BM25<T> {
  private readonly documents: string[][];
  private readonly frequencies: Array<Map<string, number>>;
  private readonly idf: Map<string, number>;
  private readonly averageLength: number;

  constructor(private readonly items: T[], extractor: (item: T) => string) {
    this.documents = items.map((item) => tokenize(extractor(item)));
    this.frequencies = this.documents.map((document) => {
      const frequency = new Map<string, number>();
      document.forEach((term) => frequency.set(term, (frequency.get(term) ?? 0) + 1));
      return frequency;
    });
    this.averageLength = this.documents.reduce((total, document) => total + document.length, 0) / Math.max(this.documents.length, 1);
    const documentFrequency = new Map<string, number>();
    this.frequencies.forEach((frequency) => frequency.forEach((_, term) => documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)));
    this.idf = new Map([...documentFrequency.entries()].map(([term, count]) => [term, Math.log((this.items.length - count + 0.5) / (count + 0.5) + 1)]));
  }

  search(query: string, limit = 5): Array<{ item: T; score: number; matchedTerms: string[] }> {
    const queryTerms = expandQuery(query);
    return this.items
      .map((item, index) => {
        const frequency = this.frequencies[index];
        const length = this.documents[index].length;
        let score = 0;
        const matchedTerms: string[] = [];
        queryTerms.forEach((term) => {
          const count = frequency.get(term) ?? 0;
          const idf = this.idf.get(term) ?? 0;
          if (count > 0) {
            score += idf * (count * 2.5) / (count + 1.5 * (1 - 0.75 + 0.75 * length / Math.max(this.averageLength, 1)));
            matchedTerms.push(term);
          }
        });
        return { item, score, matchedTerms };
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}

function productText(product: Product): string {
  return [
    product.id,
    product.title,
    product.summary,
    product.goal,
    product.keywords.join(" "),
    product.sections.join(" "),
    product.components.join(" "),
    product.copyRules.join(" ")
  ].join(" ");
}

export function searchProducts(products: Product[], query: string, limit = 5): SearchHit[] {
  return new BM25(products, productText).search(query, limit).map(({ item, score, matchedTerms }) => ({ product: item, score, matchedTerms }));
}

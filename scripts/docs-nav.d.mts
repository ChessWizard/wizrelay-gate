/** Types for the documentation navigation generator, so the docs test can be strict. */
export type DocLanguage = 'en' | 'tr';

export interface DocSection {
  slug: string;
  en: string;
  tr: string;
}

export declare const DOCS: string;
export declare const LANGUAGES: DocLanguage[];
export declare const DEFAULT_LANGUAGE: DocLanguage;
export declare const SECTIONS: DocSection[];

export declare function bodyOf(text: string): string;
export declare function renderFile(
  path: string,
  section: DocSection,
  index: number,
  language: DocLanguage,
): string;
export declare function summaryOf(path: string): string;
export declare function renderIndex(language: DocLanguage): string;
export declare function run(): void;

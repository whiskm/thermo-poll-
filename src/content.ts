import data from '../content/questions.json';

export type Diagram = { file: string; caption: string };
export type Question = {
  id: number;
  section: string;
  short: string;
  question: string;
  answer: string[];
  formulas: string[];
  keyTerms: string[];
  diagrams: Diagram[];
};
export type Section = { id: string; title: string; from: number; to: number };

export const SECTIONS: Section[] = data.sections;
export const QUESTIONS: Question[] = data.questions;
export const TOTAL = QUESTIONS.length;
export const byId = new Map<number, Question>(QUESTIONS.map((q) => [q.id, q]));
export const sectionById = new Map<string, Section>(SECTIONS.map((s) => [s.id, s]));

export const SECTION_SHORT: Record<string, string> = {
  basics: 'Основы',
  gases: 'Газы и смеси',
  process: 'Процессы газа',
  steam: 'Водяной пар',
  air: 'Влажный воздух',
  cycles: 'Циклы',
};

const svgs = import.meta.glob('../content/diagrams/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function diagramSvg(file: string): string {
  return svgs[`../content/diagrams/${file}`] ?? '';
}

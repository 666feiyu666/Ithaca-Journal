export interface LetterContent {
  title: string;
  sender: string;
  content: string;
}

export const TOTAL_LETTER_DAYS: number;
export const REFLECTION_PROMPTS: Record<number, string>;
export const LETTERS: Record<number, LetterContent>;

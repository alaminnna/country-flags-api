export const DUEL_VERSION = 0x01;

export const MODES = [
  'flag-to-country',
  'country-to-flag',
  'flag-to-capital',
  'flag-to-region',
  'mixed',
] as const;
export type Mode = (typeof MODES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const COUNTS = [5, 10, 15, 20] as const;
export type Count = (typeof COUNTS)[number];

export const SKIPPED = 0xff;

export interface DuelPayload {
  version: number;
  seed: bigint;
  mode: Mode;
  difficulty: Difficulty;
  count: Count;
  challengerScore: number;
  challengerName: string;
  answers: number[];
  timesMs: number[];
  checksum: number;
}

export interface DuelMeta {
  checksum: number;
  seed: bigint;
  mode: Mode;
  difficulty: Difficulty;
  count: Count;
  challengerName: string;
  challengerScore: number;
  createdAt: number;
}

export interface DuelResult {
  checksum: number;
  payload: DuelPayload;
  playerScore: number;
  playerAnswers: number[];
  playerTimesMs: number[];
  winner: 'challenger' | 'player' | 'draw';
  completedAt: number;
}

export interface DuelStore {
  created: Record<number, DuelMeta>;
  completed: Record<number, DuelResult>;
}

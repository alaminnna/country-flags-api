import { describe, it, expect } from 'vitest';
import { scoreQuestion } from '../quiz';

describe('scoreQuestion', () => {
  it('wrong answer always 0', () => {
    expect(scoreQuestion(false, 0, 1)).toBe(0);
    expect(scoreQuestion(false, 5000, 5)).toBe(0);
  });

  it('correct instant answer with no streak', () => {
    expect(scoreQuestion(true, 0, 1)).toBe(150); // 100 + 50
  });

  it('streak bonus applies', () => {
    expect(scoreQuestion(true, 0, 2)).toBe(160); // 100 + 50 + 10
    expect(scoreQuestion(true, 0, 3)).toBe(170); // 100 + 50 + 20
  });

  it('negative time clamped to 0', () => {
    expect(scoreQuestion(true, -100, 1)).toBe(150);
  });

  it('very high time gives 0 time bonus', () => {
    expect(scoreQuestion(true, 10000, 1)).toBe(100);
    expect(scoreQuestion(true, 20000, 1)).toBe(100);
  });
});

describe('scoreQuestion 100ms bucketing', () => {
  it('99ms and 100ms produce same score', () => {
    expect(scoreQuestion(true, 99, 1)).toBe(scoreQuestion(true, 100, 1));
  });

  it('199ms and 200ms produce different scores', () => {
    // 199→bucketed 100→50-0=50; 200→bucketed 200→50-1=49
    expect(scoreQuestion(true, 199, 1)).toBe(150);
    expect(scoreQuestion(true, 200, 1)).toBe(149);
  });

  it('0ms gives max time bonus', () => {
    expect(scoreQuestion(true, 0, 1)).toBe(150);
  });

  it('10000ms gives 0 time bonus', () => {
    expect(scoreQuestion(true, 10000, 1)).toBe(100);
  });

  it('all multiples of 100ms bucket correctly', () => {
    // 0→150, 100→150, 200→149, 300→148, ...
    for (let ms = 0; ms <= 10000; ms += 100) {
      const score = scoreQuestion(true, ms, 1);
      const expected = Math.max(0, 150 - Math.floor(ms / 200));
      expect(score).toBe(expected);
    }
  });
});

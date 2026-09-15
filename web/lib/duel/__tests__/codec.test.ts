import { describe, it, expect } from 'vitest';
import { encodeDuel, decodeDuel, DuelCodecError } from '../codec';
import { DuelPayload, COUNTS, SKIPPED } from '../types';

function makePayload(overrides: Partial<DuelPayload> = {}): Omit<DuelPayload, 'checksum'> {
  return {
    version: 0x01,
    seed: 1234567890123456789n,
    mode: 'mixed',
    difficulty: 'medium',
    count: 10,
    challengerScore: 1240,
    challengerName: 'Rahim',
    answers: [0, 1, 2, 3, 4, SKIPPED, 1, 2, 3, 0],
    timesMs: [3200, 1500, 4100, 800, 2100, 15000, 3400, 2900, 1200, 5000],
    ...overrides,
  };
}

describe('DuelCodec', () => {
  describe('round-trip', () => {
    it.each(COUNTS)('round-trips correctly at count=%i', (count) => {
      const answers = Array.from({ length: count }, (_, i) => (i % 6 === 5 ? SKIPPED : i % 6));
      const timesMs = Array.from({ length: count }, (_, i) => (i * 317) % 15000);
      const payload = makePayload({ count: count as DuelPayload['count'], answers, timesMs });
      const encoded = encodeDuel(payload);
      const decoded = decodeDuel(encoded);
      expect(decoded.seed).toBe(payload.seed);
      expect(decoded.mode).toBe(payload.mode);
      expect(decoded.difficulty).toBe(payload.difficulty);
      expect(decoded.count).toBe(payload.count);
      expect(decoded.challengerScore).toBe(payload.challengerScore);
      expect(decoded.challengerName).toBe(payload.challengerName);
      expect(decoded.answers).toEqual(payload.answers);
      expect(decoded.timesMs).toEqual(payload.timesMs.map((t) => Math.floor(t / 100) * 100));
    });
  });

  describe('URL length', () => {
    it('stays under 200 chars at count=20 with 24-char name', () => {
      const payload = makePayload({
        count: 20,
        challengerName: 'A'.repeat(24),
        answers: Array(20).fill(3),
        timesMs: Array(20).fill(15000),
      });
      const encoded = encodeDuel(payload);
      const url = `https://example.com/quiz/duel?d=${encoded}`;
      expect(url.length).toBeLessThan(200);
    });
  });

  describe('error handling', () => {
    it('throws on corrupted checksum', () => {
      const encoded = encodeDuel(makePayload());
      const last = encoded.slice(-1);
      const corrupted = encoded.slice(0, -1) + (last === 'A' ? 'B' : 'A');
      expect(() => decodeDuel(corrupted)).toThrow(DuelCodecError);
    });

    it('throws on truncated data', () => {
      const encoded = encodeDuel(makePayload());
      expect(() => decodeDuel(encoded.slice(0, 20))).toThrow(DuelCodecError);
    });

    it('throws on empty string', () => {
      expect(() => decodeDuel('')).toThrow(DuelCodecError);
    });
  });

  describe('empty name', () => {
    it('round-trips with empty challenger name', () => {
      const payload = makePayload({ challengerName: '' });
      const decoded = decodeDuel(encodeDuel(payload));
      expect(decoded.challengerName).toBe('');
    });
  });

  describe('skipped answers', () => {
    it('preserves 0xFF skipped markers', () => {
      const payload = makePayload({ count: 5, answers: [0, SKIPPED, 2, SKIPPED, 4], timesMs: [100, 200, 300, 400, 500] });
      const decoded = decodeDuel(encodeDuel(payload));
      expect(decoded.answers).toEqual([0, SKIPPED, 2, SKIPPED, 4]);
    });
  });

  describe('time bucketing', () => {
    it('floors times to 100ms buckets', () => {
      const payload = makePayload({ count: 5, answers: [0, 1, 2, 3, 4], timesMs: [0, 99, 199, 1234, 15000] });
      const decoded = decodeDuel(encodeDuel(payload));
      expect(decoded.timesMs).toEqual([0, 0, 100, 1200, 15000]);
    });
  });

  describe('checksum stability', () => {
    it('re-encoding preserves checksum', () => {
      const decoded = decodeDuel(encodeDuel(makePayload()));
      const reDecoded = decodeDuel(encodeDuel(decoded));
      expect(reDecoded.checksum).toBe(decoded.checksum);
    });
  });
});

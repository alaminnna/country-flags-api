import { DuelPayload, DUEL_VERSION, SKIPPED, MODES, DIFFICULTIES, COUNTS } from './types';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a32(data: Uint8Array): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class DuelCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuelCodecError';
  }
}

function truncateNameTo24Bytes(name: string): Uint8Array {
  const trimmed = name.trim();
  let sliced = trimmed.slice(0, 24);
  let bytes = new TextEncoder().encode(sliced);
  while (bytes.length > 24 && sliced.length > 0) {
    sliced = sliced.slice(0, -1);
    bytes = new TextEncoder().encode(sliced);
  }
  return bytes;
}

/**
 * Encode a duel payload into a base64url string for use as ?d= param.
 *
 * Binary layout (little-endian):
 *   byte 0        version (0x01)
 *   bytes 1-8     seed as u64 LE
 *   byte 9        mode index (frozen order matching Go Modes)
 *   byte 10       difficulty index (frozen order matching Go Difficulties)
 *   byte 11       count (literal 5/10/15/20)
 *   bytes 12-15   challenger score u32 LE
 *   byte 16       name length N (0-24), then N UTF-8 bytes
 *   then          count x 1 byte answers (0-5 or 0xFF)
 *   then          count x 2 bytes times u16 LE (100ms buckets)
 *   last 4 bytes  FNV-1a32 checksum (LE)
 *
 * Honor-system note: payload is client-decodable; duels are trust-based
 * fun, not a competitive integrity system.
 */
export function encodeDuel(input: Omit<DuelPayload, 'checksum'>): string {
  const nameBytes = truncateNameTo24Bytes(input.challengerName ?? '');

  const modeIdx = (MODES as readonly string[]).indexOf(input.mode);
  const diffIdx = (DIFFICULTIES as readonly string[]).indexOf(input.difficulty);
  if (modeIdx < 0 || diffIdx < 0) {
    throw new DuelCodecError('Invalid mode/difficulty');
  }
  if (!(COUNTS as readonly number[]).includes(input.count)) {
    throw new DuelCodecError('Invalid count');
  }
  if (input.answers.length !== input.count || input.timesMs.length !== input.count) {
    throw new DuelCodecError('Answers/times length must match count');
  }

  const totalLen = 17 + nameBytes.length + input.count + input.count * 2 + 4;
  const buf = new ArrayBuffer(totalLen);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  let offset = 0;
  view.setUint8(offset, DUEL_VERSION);
  offset += 1;
  view.setBigUint64(offset, BigInt(input.seed), true);
  offset += 8;
  view.setUint8(offset, modeIdx);
  offset += 1;
  view.setUint8(offset, diffIdx);
  offset += 1;
  view.setUint8(offset, input.count);
  offset += 1;
  view.setUint32(offset, input.challengerScore >>> 0, true);
  offset += 4;
  view.setUint8(offset, nameBytes.length);
  offset += 1;
  bytes.set(nameBytes, offset);
  offset += nameBytes.length;

  for (let i = 0; i < input.count; i++) {
    const a = input.answers[i] ?? SKIPPED;
    if (a !== SKIPPED && (a < 0 || a > 5)) {
      throw new DuelCodecError('Answer index out of range');
    }
    view.setUint8(offset, a);
    offset += 1;
  }

  for (let i = 0; i < input.count; i++) {
    const bucketed = Math.floor((input.timesMs[i] ?? 0) / 100);
    view.setUint16(offset, Math.min(Math.max(bucketed, 0), 0xffff), true);
    offset += 2;
  }

  const checksum = fnv1a32(bytes.slice(0, offset));
  view.setUint32(offset, checksum, true);

  return base64urlEncode(bytes);
}

export function decodeDuel(encoded: string): DuelPayload {
  let bytes: Uint8Array;
  try {
    bytes = base64urlDecode(encoded);
  } catch {
    throw new DuelCodecError('This duel link is not valid. Ask your friend to resend it.');
  }

  if (bytes.length < 17 + 4) {
    throw new DuelCodecError('This duel link is incomplete. Ask your friend to resend it.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  const version = view.getUint8(offset);
  offset += 1;
  if (version !== DUEL_VERSION) {
    throw new DuelCodecError('This duel link is from an older version. Ask your friend to create a new one.');
  }

  const seed = view.getBigUint64(offset, true);
  offset += 8;

  const modeIdx = view.getUint8(offset);
  offset += 1;
  if (modeIdx >= MODES.length) {
    throw new DuelCodecError('This duel link has an unknown quiz mode. Ask your friend to resend it.');
  }

  const diffIdx = view.getUint8(offset);
  offset += 1;
  if (diffIdx >= DIFFICULTIES.length) {
    throw new DuelCodecError('This duel link has an unknown difficulty. Ask your friend to resend it.');
  }

  const count = view.getUint8(offset);
  offset += 1;
  if (!(COUNTS as readonly number[]).includes(count)) {
    throw new DuelCodecError('This duel link has an invalid question count. Ask your friend to resend it.');
  }

  const challengerScore = view.getUint32(offset, true);
  offset += 4;

  const nameLen = view.getUint8(offset);
  offset += 1;
  if (nameLen > 24 || offset + nameLen > bytes.length - 4) {
    throw new DuelCodecError('This duel link is corrupted. Ask your friend to resend it.');
  }
  let challengerName = '';
  if (nameLen > 0) {
    try {
      challengerName = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.slice(offset, offset + nameLen)
      );
    } catch {
      throw new DuelCodecError('This duel link has an unreadable name. Ask your friend to resend it.');
    }
    offset += nameLen;
  }

  if (offset + count > bytes.length - 4) {
    throw new DuelCodecError('This duel link is truncated. Ask your friend to resend it.');
  }
  const answers: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = view.getUint8(offset);
    offset += 1;
    if (a !== SKIPPED && a > 5) {
      throw new DuelCodecError('This duel link contains invalid answers. Ask your friend to resend it.');
    }
    answers.push(a);
  }

  if (offset + count * 2 > bytes.length - 4) {
    throw new DuelCodecError('This duel link is truncated. Ask your friend to resend it.');
  }
  const timesMs: number[] = [];
  for (let i = 0; i < count; i++) {
    timesMs.push(view.getUint16(offset, true) * 100);
    offset += 2;
  }

  if (offset + 4 !== bytes.length) {
    throw new DuelCodecError('This duel link has extra data. Ask your friend to resend it.');
  }
  const expected = fnv1a32(bytes.slice(0, offset));
  const actual = view.getUint32(offset, true);
  if (expected !== actual) {
    throw new DuelCodecError('This duel link was corrupted. Ask your friend to resend it.');
  }

  return {
    version,
    seed,
    mode: MODES[modeIdx],
    difficulty: DIFFICULTIES[diffIdx],
    count: count as DuelPayload['count'],
    challengerScore,
    challengerName,
    answers,
    timesMs,
    checksum: actual,
  };
}

export function duelChecksum(payload: DuelPayload): number {
  return payload.checksum;
}

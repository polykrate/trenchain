import type { FixedBytes } from 'dedot/codecs';

/**
 * Convert a hex-encoded string (0x...) to UTF-8.
 * Dedot returns BoundedVec<u8> as HexString (Bytes type).
 */
export function hexToString(hex: string): string {
  if (!hex || hex === '0x') return '';
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  if (clean.length === 0) return '';
  const arr = new Uint8Array(clean.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return new TextDecoder().decode(arr);
}

/**
 * Decode a Bytes field (Uint8Array or HexString) to UTF-8 string.
 */
export function decodeBytes(bytes: Uint8Array | string | undefined): string {
  if (!bytes) return '';
  if (typeof bytes === 'string') return hexToString(bytes);
  return new TextDecoder().decode(bytes);
}

/**
 * Decode a fixed-size code (FixedBytes<32> or FixedBytes<16>) to a
 * null-terminated ASCII string (the on-chain ID representation).
 */
export function decodeCode(hex: FixedBytes<32> | FixedBytes<16> | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof hex === 'string') {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    bytes = new Uint8Array(clean.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  } else {
    bytes = hex;
  }
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end === -1 ? undefined : end));
}

/**
 * Encode a JS string into a fixed-size code (zero-padded).
 */
export function toCode32(str: string): `0x${string}` {
  const buf = new Uint8Array(32);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 32));
  return ('0x' + Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

export function toCode16(str: string): `0x${string}` {
  const buf = new Uint8Array(16);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 16));
  return ('0x' + Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

/**
 * Format a WeaponRange enum from chain to display string.
 */
export function formatWeaponRange(range: any): string {
  if (!range) return '—';
  if (typeof range === 'string') {
    if (range === 'Melee') return 'Melee';
    if (range === 'None') return '—';
    return range;
  }
  if (range.type === 'Melee') return 'Melee';
  if (range.type === 'None') return '—';
  if (range.type === 'Ranged') return `${range.value?.inches ?? 0}″`;
  if (range.type === 'DualPurpose') return `${range.value?.inches ?? 0}″ / Melee`;
  return '—';
}

/**
 * Format a BaseSize enum from chain.
 */
export function formatBase(base: any): string {
  if (!base) return '32mm';
  if (base.type === 'Round') return `${base.value?.diameterMm ?? 32}mm`;
  if (base.type === 'Oval') return `${base.value?.widthMm ?? 25}x${base.value?.lengthMm ?? 50}mm`;
  return '32mm';
}

// UUIDv7 keeps ids roughly time-ordered, like Prisma's uuid(7) on the server,
// so `ORDER BY id DESC` stays meaningful for notes created in the same
// millisecond.
//
// The creation time is the first 48 bits, big-endian. Two writes cover it, and
// that also keeps the byte loop out of the hot path.
function writeTimestamp(bytes: Uint8Array, timestamp: number): void {
  const view = new DataView(bytes.buffer);
  view.setUint16(0, Math.floor(timestamp / 2 ** 32));
  view.setUint32(2, timestamp >>> 0);
}

export function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  writeTimestamp(bytes, Date.now());
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

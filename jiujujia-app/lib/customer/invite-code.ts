/** Invite codes: 6 characters, no easily confused 0/O/1/I. Keep in sync with validCode() in firestore.rules. */
export const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 6;
const CODE_PATTERN = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/** `randomInt(n)` must return an integer in [0, n). Defaults to crypto-strength randomness. */
export function generateInviteCode(randomInt: (n: number) => number = cryptoRandomInt): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

/** Case-insensitive; ignores spaces and dashes people type when copying. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidInviteCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

function cryptoRandomInt(n: number): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % n;
}

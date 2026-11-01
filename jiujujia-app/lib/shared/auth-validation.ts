const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_DISPLAY_NAME_LENGTH = 20;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "請輸入 Email";
  if (!EMAIL_PATTERN.test(email.trim())) return "Email 格式不正確";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "請輸入密碼";
  if (password.length < MIN_PASSWORD_LENGTH) return `密碼至少需要 ${MIN_PASSWORD_LENGTH} 碼`;
  return null;
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "請輸入稱呼";
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) return `稱呼最多 ${MAX_DISPLAY_NAME_LENGTH} 個字`;
  return null;
}

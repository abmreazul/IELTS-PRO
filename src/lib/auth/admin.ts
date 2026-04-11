/** Comma-separated admin emails from env (server-only). Case-insensitive match. */
export function getAdminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if (t) set.add(t);
  }
  return set;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmailSet().has(email.trim().toLowerCase());
}

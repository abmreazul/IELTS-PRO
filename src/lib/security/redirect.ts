export function sanitizeRelativeRedirectPath(raw: string | null | undefined, origin: string): string {
  if (!raw) return "/";

  try {
    const parsed = new URL(raw, origin);
    if (parsed.origin !== origin) return "/";
    if (!parsed.pathname.startsWith("/")) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

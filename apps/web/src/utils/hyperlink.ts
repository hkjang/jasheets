const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Returns a trimmed URL when it is safe to place in a spreadsheet link.
 * Only explicit web and email schemes are accepted; relative URLs and
 * executable schemes such as javascript: are deliberately rejected.
 */
export function normalizeHyperlinkUrl(value: string): string | null {
  const candidate = value.trim();

  if (!candidate || CONTROL_CHARACTERS.test(candidate)) {
    return null;
  }

  try {
    const parsed = new URL(candidate);

    if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
      return null;
    }

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.hostname ? candidate : null;
    }

    const recipient = parsed.pathname.trim();
    return recipient && recipient.includes('@') ? candidate : null;
  } catch {
    return null;
  }
}

export function isSafeHyperlinkUrl(value: string): boolean {
  return normalizeHyperlinkUrl(value) !== null;
}

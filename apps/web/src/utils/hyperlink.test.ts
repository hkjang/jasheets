import { isSafeHyperlinkUrl, normalizeHyperlinkUrl } from './hyperlink';

describe('hyperlink URL validation', () => {
  it.each([
    'https://example.com',
    'http://localhost:3000/sheet?id=1',
    'mailto:user@example.com',
    'mailto:user@example.com?subject=JaSheets',
  ])('accepts a supported URL: %s', (url) => {
    expect(isSafeHyperlinkUrl(url)).toBe(true);
  });

  it.each([
    '',
    'example.com',
    '/relative/path',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com',
    'https://',
    'mailto:not-an-address',
    'https://example.com\njavascript:alert(1)',
  ])('rejects an unsupported or unsafe URL: %s', (url) => {
    expect(isSafeHyperlinkUrl(url)).toBe(false);
  });

  it('trims harmless surrounding whitespace', () => {
    expect(normalizeHyperlinkUrl('  https://example.com/docs  ')).toBe(
      'https://example.com/docs',
    );
  });
});

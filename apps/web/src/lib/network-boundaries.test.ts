import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const SOURCE_ROOTS = ['app', 'components'].map((directory) =>
  join(process.cwd(), 'src', directory),
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

describe('browser network boundaries', () => {
  it('routes page and component requests through the bounded API layer', () => {
    const violations = SOURCE_ROOTS.flatMap(sourceFiles)
      .filter((path) => /\bfetch\s*\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(process.cwd(), path));

    expect(violations).toEqual([]);
  });
});

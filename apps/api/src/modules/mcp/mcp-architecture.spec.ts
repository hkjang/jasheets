import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith('.ts') && !path.endsWith('.spec.ts')
        ? [path]
        : [];
  });

describe('MCP architecture boundary', () => {
  it('does not import Prisma or database clients from the MCP adapter', () => {
    for (const file of sourceFiles(__dirname)) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/PrismaService|@prisma\/client|\.prisma\b/);
    }
  });
});

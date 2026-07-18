const SHEET_REFERENCE = /(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!(\$?[A-Z]+\$?[1-9][0-9]*(?::\$?[A-Z]+\$?[1-9][0-9]*)?)/gi;

function quotedSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

export function rewriteSheetReferences(
  formula: string,
  sheetName: string,
  replacement?: string,
): string {
  let result = '';
  let segmentStart = 0;
  let inString = false;
  const rewrite = (segment: string) => segment.replace(
    SHEET_REFERENCE,
    (match, quoted: string | undefined, unquoted: string | undefined, reference: string) => {
      const referencedName = quoted ? quoted.replace(/''/g, "'") : unquoted;
      if (referencedName?.toLocaleLowerCase() !== sheetName.toLocaleLowerCase()) return match;
      return replacement === undefined
        ? '#REF!'
        : `${quotedSheetName(replacement)}!${reference}`;
    },
  );

  for (let index = 0; index < formula.length; index++) {
    if (formula[index] !== '"') continue;
    if (inString && formula[index + 1] === '"') {
      index += 1;
      continue;
    }
    if (!inString) {
      result += rewrite(formula.slice(segmentStart, index));
      segmentStart = index;
      inString = true;
    } else {
      result += formula.slice(segmentStart, index + 1);
      segmentStart = index + 1;
      inString = false;
    }
  }
  const tail = formula.slice(segmentStart);
  return result + (inString ? tail : rewrite(tail));
}

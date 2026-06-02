/**
 * Decide the Node module format of compiled JavaScript.
 *
 * `.cts`/`.mts` sources carry their format in the extension; for a `.ts` the
 * emitted JavaScript is classified by its syntax, exactly as Node's own
 * detection does: a top-level `import`/`export` statement or an `import.meta`
 * reference makes it an ES module, anything else is CommonJS. The scan walks
 * only real code — strings, template text, comments, and regex literals are
 * skipped — so a marker word inside a literal (`"export const x"`,
 * `/import\.meta/`) never flips the result.
 */
export function detectModuleFormat(
  sourceFile: string,
  emittedCode: string,
): "module" | "commonjs" {
  if (sourceFile.endsWith(".mts")) {
    return "module";
  }
  if (sourceFile.endsWith(".cts")) {
    return "commonjs";
  }
  return hasEsmSyntax(emittedCode) ? "module" : "commonjs";
}

/** True when `code` carries unambiguous ES module syntax in a code position. */
export function hasEsmSyntax(code: string): boolean {
  let atStatementStart = true;
  let i = 0;
  while (i < code.length) {
    const skipped = skipNonCode(code, i);
    if (skipped !== i) {
      i = skipped;
      atStatementStart = false;
      continue;
    }
    const ch = code[i]!;
    if (ch === "\n" || ch === ";" || ch === "{" || ch === "}") {
      atStatementStart = true;
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (
      atStatementStart &&
      (matches(code, i, "import") || matches(code, i, "export"))
    ) {
      return true;
    }
    if (matchesImportMeta(code, i)) {
      return true;
    }
    atStatementStart = false;
    i += 1;
  }
  return false;
}

/** Advance past a string, template, comment, or regex literal starting at `i`. */
function skipNonCode(code: string, i: number): number {
  const ch = code[i];
  const next = code[i + 1];
  if (ch === '"' || ch === "'") {
    return skipQuoted(code, i, ch);
  }
  if (ch === "`") {
    return skipTemplate(code, i);
  }
  if (ch === "/" && next === "/") {
    const end = code.indexOf("\n", i + 2);
    return end === -1 ? code.length : end;
  }
  if (ch === "/" && next === "*") {
    const end = code.indexOf("*/", i + 2);
    return end === -1 ? code.length : end + 2;
  }
  if (ch === "/" && looksLikeRegex(code, i)) {
    return skipRegex(code, i);
  }
  return i;
}

function skipQuoted(code: string, start: number, quote: string): number {
  for (let i = start + 1; i < code.length; i += 1) {
    if (code[i] === "\\") {
      i += 1;
      continue;
    }
    if (code[i] === quote) {
      return i + 1;
    }
  }
  return code.length;
}

function skipTemplate(code: string, start: number): number {
  for (let i = start + 1; i < code.length; i += 1) {
    if (code[i] === "\\") {
      i += 1;
      continue;
    }
    if (code[i] === "`") {
      return i + 1;
    }
  }
  return code.length;
}

function skipRegex(code: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === "[") {
      inClass = true;
    } else if (ch === "]") {
      inClass = false;
    } else if (ch === "/" && !inClass) {
      return i + 1;
    }
  }
  return code.length;
}

function looksLikeRegex(code: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && /\s/.test(code[i]!)) {
    i -= 1;
  }
  if (i < 0) {
    return true;
  }
  return "([{=,:;!?&|+-*~^<>".includes(code[i]!);
}

function matches(code: string, i: number, keyword: string): boolean {
  return (
    code.startsWith(keyword, i) && !isIdentifierPart(code[i + keyword.length])
  );
}

function matchesImportMeta(code: string, i: number): boolean {
  if (!code.startsWith("import", i) || isIdentifierPart(code[i - 1])) {
    return false;
  }
  let j = i + "import".length;
  while (j < code.length && /\s/.test(code[j]!)) {
    j += 1;
  }
  if (code[j] !== ".") {
    return false;
  }
  j += 1;
  while (j < code.length && /\s/.test(code[j]!)) {
    j += 1;
  }
  return code.startsWith("meta", j) && !isIdentifierPart(code[j + 4]);
}

function isIdentifierPart(value: string | undefined): boolean {
  return value !== undefined && /[$\w]/.test(value);
}

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
function hasEsmSyntax(code: string): boolean {
  let atStatementStart = true;
  let i = 0;
  while (i < code.length) {
    const comment = skipComment(code, i);
    if (comment !== i) {
      // A comment is whitespace: it does not end a statement-start position.
      i = comment;
      continue;
    }
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
      (isModuleStatement(code, i, "import") ||
        isModuleStatement(code, i, "export"))
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

/** Advance past a line or block comment starting at `i`, else return `i`. */
function skipComment(code: string, i: number): number {
  if (code[i] !== "/") {
    return i;
  }
  const next = code[i + 1];
  if (next === "/") {
    const end = code.indexOf("\n", i + 2);
    return end === -1 ? code.length : end;
  }
  if (next === "*") {
    const end = code.indexOf("*/", i + 2);
    return end === -1 ? code.length : end + 2;
  }
  return i;
}

/**
 * Advance past a string, template, or regex literal starting at `i`. Comments
 * are handled separately because, unlike these expression literals, a comment
 * does not end a statement-start position.
 */
function skipNonCode(code: string, i: number): number {
  const ch = code[i];
  if (ch === '"' || ch === "'") {
    return skipQuoted(code, i, ch);
  }
  if (ch === "`") {
    return skipTemplate(code, i);
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

/** Keywords after which a `/` opens a regex literal, not a division operator. */
const REGEX_PREFIX_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "of",
  "new",
  "throw",
  "void",
  "yield",
  "await",
]);

function looksLikeRegex(code: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && /\s/.test(code[i]!)) {
    i -= 1;
  }
  if (i < 0) {
    return true;
  }
  if ("([{=,:;!?&|+-*~^<>".includes(code[i]!)) {
    return true;
  }
  // A `/` right after a keyword like `return` opens a regex, not division.
  let wordEnd = i + 1;
  while (i >= 0 && isIdentifierPart(code[i])) {
    i -= 1;
  }
  return REGEX_PREFIX_KEYWORDS.has(code.slice(i + 1, wordEnd));
}

/**
 * True when `keyword` (`import`/`export`) at `i` begins a real module
 * statement, not an object property key (`{ export: 1 }`), a shorthand (`{
 * import }`), or a dynamic `import(...)` call. The keyword must be followed by
 * a continuation that only a declaration/binding form allows.
 */
function isModuleStatement(code: string, i: number, keyword: string): boolean {
  if (
    !code.startsWith(keyword, i) ||
    isIdentifierPart(code[i - 1]) ||
    isIdentifierPart(code[i + keyword.length])
  ) {
    return false;
  }
  let j = i + keyword.length;
  while (j < code.length && /\s/.test(code[j]!)) {
    j += 1;
  }
  const next = code[j];
  // Reject object-key (`:`, `,`, `}`) and dynamic-import / call (`(`) contexts.
  return next !== ":" && next !== "," && next !== "}" && next !== "(";
}

function matchesImportMeta(code: string, i: number): boolean {
  if (
    !code.startsWith("import", i) ||
    isIdentifierPart(code[i - 1]) ||
    isMemberAccess(code, i)
  ) {
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

/** True when the token at `i` is a member access (`obj.import`), not a keyword. */
function isMemberAccess(code: string, i: number): boolean {
  let j = i - 1;
  while (j >= 0 && /\s/.test(code[j]!)) {
    j -= 1;
  }
  return code[j] === ".";
}

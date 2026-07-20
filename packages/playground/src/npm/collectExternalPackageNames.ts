import { BUILT_IN_PLAYGROUND_PACKAGES } from "./BUILT_IN_PLAYGROUND_PACKAGES";
import { packageNameFromSpecifier } from "./packageNameFromSpecifier";

/**
 * Scan `source` for `import` / `require` specifiers and return the unique
 * sorted list of bare npm package names that are not in `ignoredPackages`.
 */
export function collectExternalPackageNames(
  source: string,
  ignoredPackages: Iterable<string> = BUILT_IN_PLAYGROUND_PACKAGES,
): string[] {
  const ignored = new Set(ignoredPackages);
  const found = new Set<string>();
  for (const specifier of collectModuleSpecifiers(source)) {
    const packageName = packageNameFromSpecifier(specifier);
    if (packageName && !ignored.has(packageName)) found.add(packageName);
  }
  return [...found].sort();
}

/**
 * Collect the string specifiers of every executable module-loading construct in
 * `source`: `import`/`export ... from`, side-effect `import "x"`, dynamic
 * `import("x")`, and `require("x")` calls.
 *
 * The scan tokenizes `source` first so import/export/require lookalikes that
 * live inside comments, string or template contents, or regular-expression
 * literals never become package requests — only real code-level string
 * arguments are returned. Specifiers that cannot be resolved statically (a
 * template-literal or computed argument) are intentionally skipped so inert
 * text cannot drive a network install.
 */
function collectModuleSpecifiers(source: string): string[] {
  const tokens = tokenize(source);
  const out: string[] = [];
  const asString = (token: Token | undefined): string | null =>
    token && token.kind === "string" ? token.value : null;
  const isOpenParen = (token: Token | undefined): boolean =>
    token !== undefined && token.kind === "punct" && token.value === "(";
  const isMemberAccess = (token: Token | undefined): boolean =>
    token !== undefined && token.kind === "punct" && token.value === ".";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || token.kind !== "word") continue;

    if (token.value === "require") {
      // `obj.require(...)` is an unrelated method call, not CommonJS require.
      if (isMemberAccess(tokens[i - 1])) continue;
      if (isOpenParen(tokens[i + 1])) {
        const spec = asString(tokens[i + 2]);
        if (spec !== null) out.push(spec);
      }
      continue;
    }

    if (token.value === "import" || token.value === "export") {
      // `foo.import(...)` / `import.meta` are not module-loading imports.
      if (token.value === "import" && isMemberAccess(tokens[i - 1])) continue;
      // Dynamic `import("x")`.
      if (token.value === "import" && isOpenParen(tokens[i + 1])) {
        const spec = asString(tokens[i + 2]);
        if (spec !== null) out.push(spec);
        continue;
      }
      // Side-effect `import "x"`.
      if (token.value === "import") {
        const bare = asString(tokens[i + 1]);
        if (bare !== null) {
          out.push(bare);
          continue;
        }
      }
      // `import ... from "x"` / `export ... from "x"`.
      const spec = findFromSpecifier(tokens, i + 1);
      if (spec !== null) out.push(spec);
    }
  }
  return out;
}

/**
 * From token index `start`, find the specifier of a `... from "x"` clause,
 * bounded to the current statement. Stops at a `;` terminator or the start of
 * another `import`/`export` so a local `export const x = ...` never borrows a
 * later statement's `from`.
 */
function findFromSpecifier(tokens: Token[], start: number): string | null {
  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) break;
    if (token.kind === "punct" && token.value === ";") return null;
    if (
      token.kind === "word" &&
      (token.value === "import" || token.value === "export")
    )
      return null;
    if (token.kind === "word" && token.value === "from") {
      const next = tokens[i + 1];
      return next && next.kind === "string" ? next.value : null;
    }
  }
  return null;
}

type Token =
  // An identifier or keyword.
  | { kind: "word"; value: string }
  // A single- or double-quoted string literal, with escapes decoded to their
  // literal characters so a specifier survives unchanged.
  | { kind: "string"; value: string }
  // A single punctuation character.
  | { kind: "punct"; value: string }
  // An opaque value token — number, template literal, or regular-expression
  // literal — whose contents can never be a static specifier.
  | { kind: "other" };

// Keywords after which a `/` begins a regular-expression literal rather than a
// division operator. After any other word (an identifier or value keyword such
// as `this`), `/` is division.
const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "do",
  "else",
  "yield",
  "await",
  "case",
  "throw",
]);

/**
 * Lexically tokenize `source` into the coarse token stream the specifier
 * collector needs. Comments are dropped; strings, templates, regex literals,
 * and numbers become single tokens so their contents cannot leak into the
 * grammar match.
 */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  const isIdStart = (c: string): boolean =>
    (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$";
  const isIdPart = (c: string): boolean =>
    isIdStart(c) || (c >= "0" && c <= "9");
  const isDigit = (c: string): boolean => c >= "0" && c <= "9";

  // A `/` opens a regex only in operator/statement position — never right after
  // a value (identifier, number, string, template, regex, `)` or `]`).
  let i = 0;
  while (i < n) {
    const c = source[i]!;
    // Whitespace.
    if (
      c === " " ||
      c === "\t" ||
      c === "\r" ||
      c === "\n" ||
      c === "\f" ||
      c === "\v"
    ) {
      i++;
      continue;
    }
    // Line comment.
    if (c === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    // Block comment.
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // Regular-expression literal.
    if (c === "/" && isRegexAllowed(tokens)) {
      i = skipRegularExpression(source, i, isIdPart);
      tokens.push({ kind: "other" });
      continue;
    }
    // String literal.
    if (c === '"' || c === "'") {
      i++;
      let value = "";
      while (i < n) {
        const d = source[i]!;
        if (d === "\\") {
          value += source[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (d === c) {
          i++;
          break;
        }
        if (d === "\n") break; // unterminated single-line string
        value += d;
        i++;
      }
      tokens.push({ kind: "string", value });
      continue;
    }
    // Template quasis are opaque, but `${...}` substitutions are executable
    // JavaScript and must receive the same lexical treatment as top-level code.
    if (c === "`") {
      i++;
      while (i < n) {
        const d = source[i];
        if (d === "\\") {
          i += 2;
          continue;
        }
        if (d === "`") {
          i++;
          break;
        }
        if (d === "$" && source[i + 1] === "{") {
          const start = i + 2;
          const end = findTemplateSubstitutionEnd(source, start);
          tokens.push({ kind: "other" }, ...tokenize(source.slice(start, end)));
          tokens.push({ kind: "other" });
          i = end < n ? end + 1 : end;
          continue;
        }
        i++;
      }
      tokens.push({ kind: "other" });
      continue;
    }
    // Identifier / keyword.
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdPart(source[j]!)) j++;
      tokens.push({ kind: "word", value: source.slice(i, j) });
      i = j;
      continue;
    }
    // Numeric literal.
    if (isDigit(c) || (c === "." && isDigit(source[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxXoObBeE._]/.test(source[j]!)) j++;
      tokens.push({ kind: "other" });
      i = j;
      continue;
    }
    // Single punctuation character.
    tokens.push({ kind: "punct", value: c });
    i++;
  }
  return tokens;
}

function findTemplateSubstitutionEnd(source: string, start: number): number {
  let depth = 1;
  let previous: Token | undefined;
  const isIdentifierStart = (character: string): boolean =>
    /[A-Za-z_$]/.test(character);
  const isIdentifierPart = (character: string): boolean =>
    /[A-Za-z0-9_$]/.test(character);
  for (let i = start; i < source.length; i++) {
    const c = source[i]!;
    if (/\s/.test(c)) continue;
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      i = skipQuoted(source, i, c);
      previous = { kind: "string", value: "" };
      continue;
    }
    if (c === "`") {
      i = skipTemplate(source, i);
      previous = { kind: "other" };
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/"))
        i++;
      i++;
      continue;
    }
    if (c === "/" && isRegexAllowedAfter(previous)) {
      i = skipRegularExpression(source, i, (character) =>
        /[A-Za-z0-9_$]/.test(character),
      );
      i--;
      previous = { kind: "other" };
      continue;
    }
    if (isIdentifierStart(c)) {
      let end = i + 1;
      while (end < source.length && isIdentifierPart(source[end]!)) end++;
      previous = { kind: "word", value: source.slice(i, end) };
      i = end - 1;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let end = i + 1;
      while (end < source.length && /[0-9a-fA-FxXoObBeE._]/.test(source[end]!))
        end++;
      previous = { kind: "other" };
      i = end - 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
    previous = { kind: "punct", value: c };
  }
  return source.length;
}

function isRegexAllowed(tokens: readonly Token[]): boolean {
  return isRegexAllowedAfter(tokens[tokens.length - 1]);
}

function isRegexAllowedAfter(previous: Token | undefined): boolean {
  if (!previous) return true;
  if (previous.kind === "string" || previous.kind === "other") return false;
  if (previous.kind === "word")
    return REGEX_PRECEDING_KEYWORDS.has(previous.value);
  return previous.value !== ")" && previous.value !== "]";
}

function skipRegularExpression(
  source: string,
  start: number,
  isIdentifierPart: (character: string) => boolean,
): number {
  let index = start + 1;
  let inClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "\n") break;
    if (character === "[") inClass = true;
    else if (character === "]") inClass = false;
    else if (character === "/" && !inClass) {
      index++;
      break;
    }
    index++;
  }
  while (index < source.length && isIdentifierPart(source[index]!)) index++;
  return index;
}

function skipQuoted(source: string, start: number, quote: string): number {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === "\\") {
      i++;
      continue;
    }
    if (source[i] === quote || source[i] === "\n") return i;
  }
  return source.length;
}

function skipTemplate(source: string, start: number): number {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === "\\") {
      i++;
      continue;
    }
    if (source[i] === "`") return i;
    if (source[i] === "$" && source[i + 1] === "{") {
      i = findTemplateSubstitutionEnd(source, i + 2);
    }
  }
  return source.length;
}

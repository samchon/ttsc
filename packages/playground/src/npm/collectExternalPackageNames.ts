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
 * `import("x")`, `require("x")`, and `require?.("x")` calls.
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
    token !== undefined &&
    token.kind === "punct" &&
    (token.value === "." || token.value === "?.");
  const isOptionalChain = (token: Token | undefined): boolean =>
    token !== undefined && token.kind === "punct" && token.value === "?.";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || token.kind !== "word") continue;

    if (token.value === "require") {
      // `obj.require(...)` is an unrelated method call, not CommonJS require.
      if (isMemberAccess(tokens[i - 1])) continue;
      const optional =
        isOptionalChain(tokens[i + 1]) && isOpenParen(tokens[i + 2]);
      if (isOpenParen(tokens[i + 1]) || optional) {
        const spec = asString(tokens[i + (optional ? 3 : 2)]);
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
  // A punctuation token; compound forms are retained where lexical state or
  // module-call recognition depends on them.
  | {
      kind: "punct";
      value: string;
      /** Whether a slash after this closing delimiter begins a regex literal. */
      regexAllowedAfter?: boolean;
      /** Whether this closes a function parameter list for an expression. */
      functionBodyIsExpression?: boolean;
    }
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
  "extends",
  "yield",
  "await",
  "case",
  "throw",
]);

const CONTROL_HEADER_KEYWORDS = new Set([
  "if",
  "while",
  "for",
  "with",
  "switch",
  "catch",
]);
const BLOCK_PRECEDING_KEYWORDS = new Set(["else", "try", "finally", "do"]);

interface IParenContext {
  kind: "control" | "function" | "normal";
  functionIsExpression?: boolean;
}

/**
 * Retain just enough delimiter context to distinguish a regex statement after
 * a control header or block from division after an expression value. The
 * collector is not a parser: this state only decides whether a following slash
 * is opaque regex text or executable code worth scanning for module calls.
 */
class LexicalContext {
  public readonly tokens: Token[] = [];

  private readonly parens: IParenContext[] = [];
  private readonly braces: boolean[] = [];
  private pendingFunctionExpression: boolean | undefined;
  private readonly pendingClassExpressions: boolean[] = [];

  public isRegexAllowed(): boolean {
    return isRegexAllowedAfter(this.tokens[this.tokens.length - 1]);
  }

  public pushWord(value: string): void {
    if (
      value === "function" &&
      !isMemberAccess(this.tokens[this.tokens.length - 1])
    )
      this.pendingFunctionExpression = isExpressionPosition(this.tokens);
    else if (
      value === "class" &&
      !isMemberAccess(this.tokens[this.tokens.length - 1])
    )
      this.pendingClassExpressions.push(isExpressionPosition(this.tokens));
    this.tokens.push({ kind: "word", value });
  }

  public pushOther(): void {
    this.tokens.push({ kind: "other" });
  }

  public pushPunct(value: string): void {
    if (value === ":") {
      const previous = this.tokens[this.tokens.length - 1];
      if (
        previous?.kind === "word" &&
        !isMemberAccess(this.tokens[this.tokens.length - 2])
      ) {
        if (previous.value === "function")
          this.pendingFunctionExpression = undefined;
        else if (previous.value === "class")
          this.pendingClassExpressions.pop();
      }
    }
    if (value === "(") {
      const functionIsExpression = this.pendingFunctionExpression;
      this.pendingFunctionExpression = undefined;
      this.parens.push(
        functionIsExpression === undefined
          ? {
              kind: isControlHeader(this.tokens) ? "control" : "normal",
            }
          : { kind: "function", functionIsExpression },
      );
      this.tokens.push({ kind: "punct", value });
      return;
    }
    if (value === ")") {
      const context = this.parens.pop();
      this.tokens.push({
        kind: "punct",
        value,
        regexAllowedAfter: context?.kind === "control",
        functionBodyIsExpression:
          context?.kind === "function"
            ? context.functionIsExpression
            : undefined,
      });
      return;
    }
    if (value === "{") {
      this.braces.push(this.braceAllowsRegexAfter());
      this.tokens.push({ kind: "punct", value });
      return;
    }
    if (value === "}") {
      this.tokens.push({
        kind: "punct",
        value,
        regexAllowedAfter: this.braces.pop() ?? false,
      });
      return;
    }
    this.tokens.push({ kind: "punct", value });
  }

  private braceAllowsRegexAfter(): boolean {
    const previous = this.tokens[this.tokens.length - 1];
    if (
      previous?.kind === "punct" &&
      previous.value === ")" &&
      previous.functionBodyIsExpression !== undefined
    )
      return !previous.functionBodyIsExpression;
    if (this.classBodyPrecedes(previous))
      return !this.pendingClassExpressions.pop()!;
    if (!previous) return true;
    if (previous.kind === "word")
      return BLOCK_PRECEDING_KEYWORDS.has(previous.value);
    if (previous.kind !== "punct") return false;
    if (previous.value === ")") return previous.regexAllowedAfter === true;
    return (
      previous.value === ";" ||
      previous.value === "{" ||
      previous.value === "}"
    );
  }

  private classBodyPrecedes(previous: Token | undefined): boolean {
    if (this.pendingClassExpressions.length === 0 || this.parens.length !== 0)
      return false;
    if (!previous) return false;
    if (previous.kind === "word" || previous.kind === "other") return true;
    return (
      previous.kind === "punct" &&
      (previous.value === ")" ||
        previous.value === "]" ||
        previous.value === "}")
    );
  }
}

function isControlHeader(tokens: readonly Token[]): boolean {
  const previous = tokens[tokens.length - 1];
  const beforePrevious = tokens[tokens.length - 2];
  if (
    previous?.kind === "word" &&
    CONTROL_HEADER_KEYWORDS.has(previous.value) &&
    !isMemberAccess(beforePrevious)
  )
    return true;
  return (
    previous?.kind === "word" &&
    previous.value === "await" &&
    beforePrevious?.kind === "word" &&
    beforePrevious.value === "for"
  );
}

function isMemberAccess(token: Token | undefined): boolean {
  return (
    token?.kind === "punct" &&
    (token.value === "." || token.value === "?.")
  );
}

function isExpressionPosition(tokens: readonly Token[]): boolean {
  let index = tokens.length - 1;
  // `async function` inherits the context before `async`: it is a declaration
  // at a statement boundary and an expression after an assignment or return.
  if (tokens[index]?.kind === "word" && tokens[index]?.value === "async")
    index--;
  const previous = tokens[index];
  if (!previous) return false;
  if (previous.kind === "word")
    return REGEX_PRECEDING_KEYWORDS.has(previous.value);
  if (previous.kind !== "punct") return false;
  return ![
    ")",
    "]",
    "}",
    ";",
    "{",
    "++",
    "--",
  ].includes(previous.value);
}

/**
 * Lexically tokenize `source` into the coarse token stream the specifier
 * collector needs. Comments are dropped; strings, templates, regex literals,
 * and numbers become single tokens so their contents cannot leak into the
 * grammar match.
 */
function tokenize(source: string): Token[] {
  const context = new LexicalContext();
  const tokens = context.tokens;
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
    if (c === "/" && context.isRegexAllowed()) {
      i = skipRegularExpression(source, i, isIdPart);
      context.pushOther();
      continue;
    }
    // String literal.
    if (c === '"' || c === "'") {
      const quoted = readQuotedString(source, i, c);
      i = quoted.end;
      if (quoted.value === null) context.pushOther();
      else tokens.push({ kind: "string", value: quoted.value });
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
          context.pushOther();
          tokens.push(...tokenize(source.slice(start, end)));
          context.pushOther();
          i = end < n ? end + 1 : end;
          continue;
        }
        i++;
      }
      context.pushOther();
      continue;
    }
    // Identifier / keyword.
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdPart(source[j]!)) j++;
      context.pushWord(source.slice(i, j));
      i = j;
      continue;
    }
    // Numeric literal.
    if (isDigit(c) || (c === "." && isDigit(source[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxXoObBeE._]/.test(source[j]!)) j++;
      context.pushOther();
      i = j;
      continue;
    }
    // Compound punctuation whose identity affects the following slash or
    // direct optional-call recognition.
    if ((c === "+" || c === "-") && source[i + 1] === c) {
      context.pushPunct(c + c);
      i += 2;
      continue;
    }
    if (c === "?" && source[i + 1] === "." && !isDigit(source[i + 2] ?? "")) {
      context.pushPunct("?.");
      i += 2;
      continue;
    }
    // Single punctuation character.
    context.pushPunct(c);
    i++;
  }
  return tokens;
}

function findTemplateSubstitutionEnd(source: string, start: number): number {
  let depth = 1;
  const context = new LexicalContext();
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
      context.tokens.push({ kind: "string", value: "" });
      continue;
    }
    if (c === "`") {
      i = skipTemplate(source, i);
      context.pushOther();
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
    if (c === "/" && context.isRegexAllowed()) {
      i = skipRegularExpression(source, i, (character) =>
        /[A-Za-z0-9_$]/.test(character),
      );
      i--;
      context.pushOther();
      continue;
    }
    if (isIdentifierStart(c)) {
      let end = i + 1;
      while (end < source.length && isIdentifierPart(source[end]!)) end++;
      context.pushWord(source.slice(i, end));
      i = end - 1;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let end = i + 1;
      while (end < source.length && /[0-9a-fA-FxXoObBeE._]/.test(source[end]!))
        end++;
      context.pushOther();
      i = end - 1;
      continue;
    }
    if ((c === "+" || c === "-") && source[i + 1] === c) {
      context.pushPunct(c + c);
      i++;
      continue;
    }
    if (
      c === "?" &&
      source[i + 1] === "." &&
      !/[0-9]/.test(source[i + 2] ?? "")
    ) {
      context.pushPunct("?.");
      i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
    context.pushPunct(c);
  }
  return source.length;
}

function isRegexAllowedAfter(previous: Token | undefined): boolean {
  if (!previous) return true;
  if (previous.kind === "string" || previous.kind === "other") return false;
  if (previous.kind === "word")
    return REGEX_PRECEDING_KEYWORDS.has(previous.value);
  if (previous.value === ")" || previous.value === "}")
    return previous.regexAllowedAfter === true;
  return (
    previous.value !== "]" &&
    previous.value !== "++" &&
    previous.value !== "--"
  );
}

interface IQuotedStringResult {
  end: number;
  value: string | null;
}

/** Read one quoted literal and compute its JavaScript StringValue. */
function readQuotedString(
  source: string,
  start: number,
  quote: string,
): IQuotedStringResult {
  let value = "";
  for (let index = start + 1; index < source.length; ) {
    const character = source[index]!;
    if (character === quote) {
      return { end: index + 1, value };
    }
    if (isLineTerminator(character)) {
      return { end: index, value: null };
    }
    if (character !== "\\") {
      value += character;
      index++;
      continue;
    }

    const escaped = source[index + 1];
    if (escaped === undefined) {
      return { end: source.length, value: null };
    }
    if (isLineTerminator(escaped)) {
      index += escaped === "\r" && source[index + 2] === "\n" ? 3 : 2;
      continue;
    }

    const simple = SIMPLE_STRING_ESCAPES[escaped];
    if (simple !== undefined) {
      value += simple;
      index += 2;
      continue;
    }
    if (escaped === "0") {
      if (/[0-9]/.test(source[index + 2] ?? "")) {
        return invalidQuotedString(source, start, quote);
      }
      value += "\0";
      index += 2;
      continue;
    }
    if (escaped >= "1" && escaped <= "9") {
      return invalidQuotedString(source, start, quote);
    }
    if (escaped === "x") {
      const digits = source.slice(index + 2, index + 4);
      if (digits.length !== 2 || !/^[0-9a-fA-F]{2}$/.test(digits)) {
        return invalidQuotedString(source, start, quote);
      }
      value += String.fromCharCode(Number.parseInt(digits, 16));
      index += 4;
      continue;
    }
    if (escaped === "u") {
      if (source[index + 2] === "{") {
        const close = source.indexOf("}", index + 3);
        const digits = close < 0 ? "" : source.slice(index + 3, close);
        const significantDigits = digits.replace(/^0+/, "") || "0";
        const codePoint = Number.parseInt(digits, 16);
        if (
          close < 0 ||
          !/^[0-9a-fA-F]+$/.test(digits) ||
          significantDigits.length > 6 ||
          codePoint > 0x10ffff
        ) {
          return invalidQuotedString(source, start, quote);
        }
        value += String.fromCodePoint(codePoint);
        index = close + 1;
        continue;
      }
      const digits = source.slice(index + 2, index + 6);
      if (digits.length !== 4 || !/^[0-9a-fA-F]{4}$/.test(digits)) {
        return invalidQuotedString(source, start, quote);
      }
      value += String.fromCharCode(Number.parseInt(digits, 16));
      index += 6;
      continue;
    }

    // IdentityEscape / NonEscapeCharacter: the slash is discarded and the
    // escaped source character contributes directly to the StringValue.
    value += escaped;
    index += 2;
  }
  return { end: source.length, value: null };
}

const SIMPLE_STRING_ESCAPES: Readonly<Record<string, string>> = {
  "'": "'",
  '"': '"',
  "\\": "\\",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

function invalidQuotedString(
  source: string,
  start: number,
  quote: string,
): IQuotedStringResult {
  const end = skipQuoted(source, start, quote);
  return {
    end: end < source.length && source[end] === quote ? end + 1 : end,
    value: null,
  };
}

function isLineTerminator(character: string): boolean {
  return (
    character === "\n" ||
    character === "\r" ||
    character === "\u2028" ||
    character === "\u2029"
  );
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
    if (source[i] === quote || isLineTerminator(source[i]!)) return i;
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

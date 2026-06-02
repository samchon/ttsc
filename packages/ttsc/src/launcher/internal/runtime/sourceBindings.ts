/**
 * Reconnect a CommonJS module's source-level import identifiers that a
 * transform plugin left referenced after TypeScript rewrote the import to a
 * `require()` alias.
 *
 * A native transform can emit CommonJS that still names a source binding (e.g.
 * `new Calc()` for `import { Calculator as Calc }`) even though tsgo turned the
 * import into `const Calculator_1 = require("./Calculator")`. Without the
 * source identifier reconnected the reference is `undefined` at runtime. This
 * injects `const Calc = Calculator_1.Calculator;` style aliases for exactly the
 * bindings the emit uses but does not already own, and never resurrects an
 * import whose `require()` the plugin commented out.
 */
export function restoreSourceImportBindings(
  sourceText: string,
  emitted: string,
): string {
  const imports = parseSourceImports(sourceText);
  if (imports.length === 0) {
    return emitted;
  }
  const code = blank(emitted, false);
  const codeNoStrings = blank(emitted, true);
  const requires = collectRequireAliases(code);
  const declared = collectDeclaredNames(code);

  const restorations: string[] = [];
  for (const entry of imports) {
    const alias = requires.get(entry.specifier);
    if (alias === undefined) {
      // No live `require()` for this module (side-effect-only or commented out).
      continue;
    }
    for (const binding of entry.bindings) {
      if (
        declared.has(binding.local) ||
        !usesBareIdentifier(codeNoStrings, binding.local)
      ) {
        continue;
      }
      restorations.push(`const ${binding.local} = ${alias}${access(binding)};`);
    }
  }
  if (restorations.length === 0) {
    return emitted;
  }
  const at = lastRequireEnd(code);
  return `${emitted.slice(0, at)}\n${restorations.join("\n")}${emitted.slice(at)}`;
}

interface ImportBinding {
  /** Local identifier the source code (and transform output) refers to. */
  readonly local: string;
  readonly kind: "named" | "default" | "namespace";
  /** Exported name for a named import; unused for default/namespace. */
  readonly imported?: string;
}

interface SourceImport {
  readonly specifier: string;
  readonly bindings: readonly ImportBinding[];
}

/** Member access that reads `binding` off its `require()` alias. */
function access(binding: ImportBinding): string {
  if (binding.kind === "namespace") {
    return "";
  }
  if (binding.kind === "default") {
    return ".default";
  }
  return `.${binding.imported}`;
}

/** Parse the value import bindings of a TypeScript source, skipping type-only. */
function parseSourceImports(sourceText: string): SourceImport[] {
  const code = blank(sourceText, false);
  const out: SourceImport[] = [];
  const pattern =
    /\bimport\s+(?:(type)\s+)?([^;'"]*?)\s+from\s*(["'])([^"']+)\3/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    if (match[1] === "type") {
      continue;
    }
    const bindings = parseClause(
      sourceText.slice(match.index, pattern.lastIndex),
    );
    if (bindings.length !== 0) {
      out.push({ specifier: match[4]!, bindings });
    }
  }
  return out;
}

/** Parse the binding clause between `import` and `from`. */
function parseClause(statement: string): ImportBinding[] {
  const clause = statement
    .replace(/^\s*import\s+/, "")
    .replace(/\s+from\s*$/, "")
    .replace(/\bfrom\s*$/, "")
    .trim();
  const bindings: ImportBinding[] = [];

  const namespace = /(?:^|,)\s*\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
  if (namespace) {
    bindings.push({ local: namespace[1]!, kind: "namespace" });
  }
  const braces = /\{([^}]*)\}/.exec(clause);
  if (braces) {
    for (const raw of braces[1]!.split(",")) {
      const piece = raw.trim();
      if (piece.length === 0 || /^type\b/.test(piece)) {
        continue;
      }
      const as = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(piece);
      if (as) {
        bindings.push({ local: as[2]!, kind: "named", imported: as[1] });
      } else if (/^[A-Za-z_$][\w$]*$/.test(piece)) {
        bindings.push({ local: piece, kind: "named", imported: piece });
      }
    }
  }
  // A leading bare identifier before `,`/`{`/`*` is the default import.
  const head = clause.split(/[,{]/)[0]!.trim();
  if (/^[A-Za-z_$][\w$]*$/.test(head) && !/^\*/.test(head)) {
    bindings.unshift({ local: head, kind: "default" });
  }
  return bindings;
}

/** Map each module specifier to its (non-commented) `require()` alias. */
function collectRequireAliases(code: string): Map<string, string> {
  const out = new Map<string, string>();
  const pattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    out.set(match[2]!, match[1]!);
  }
  return out;
}

/** Collect top-level binding names the emit already declares. */
function collectDeclaredNames(code: string): Set<string> {
  const out = new Set<string>();
  const pattern = /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    out.add(match[1]!);
  }
  return out;
}

/** True when `name` appears as a standalone identifier (not a member access). */
function usesBareIdentifier(code: string, name: string): boolean {
  return new RegExp(`(?<![.\\w$])${escapeRegExp(name)}(?![\\w$])`).test(code);
}

/** Offset just past the last `require(...)` alias declaration, else 0. */
function lastRequireEnd(code: string): number {
  const pattern = /require\(\s*["'][^"']+["']\s*\)\s*;?/g;
  let end = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    end = pattern.lastIndex;
  }
  return end;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Blank out comments, regex literals, and template literals (and strings when
 * `strings` is true) with spaces, preserving offsets and newlines so regex
 * scans operate only on real code.
 */
function blank(input: string, strings: boolean): string {
  const out = input.split("");
  let i = 0;
  while (i < out.length) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (ch === "/" && next === "/") {
      i = blankUntil(out, input, i, "\n", false);
    } else if (ch === "/" && next === "*") {
      i = blankUntil(out, input, i, "*/", true);
    } else if (ch === "`") {
      i = blankString(out, input, i, "`");
    } else if ((ch === '"' || ch === "'") && strings) {
      i = blankString(out, input, i, ch);
    } else if ((ch === '"' || ch === "'") && !strings) {
      i = skipString(input, i, ch);
    } else if (ch === "/" && opensRegex(input, i)) {
      i = blankRegex(out, input, i);
    } else {
      i += 1;
    }
  }
  return out.join("");
}

function blankUntil(
  out: string[],
  input: string,
  start: number,
  terminator: string,
  inclusive: boolean,
): number {
  const found = input.indexOf(terminator, start + 2);
  const end =
    found === -1 ? input.length : inclusive ? found + terminator.length : found;
  blankSpan(out, input, start, end);
  return end;
}

function blankString(
  out: string[],
  input: string,
  start: number,
  quote: string,
): number {
  const end = skipString(input, start, quote);
  blankSpan(out, input, start + 1, end - 1);
  return end;
}

function skipString(input: string, start: number, quote: string): number {
  for (let i = start + 1; i < input.length; i += 1) {
    if (input[i] === "\\") {
      i += 1;
      continue;
    }
    if (input[i] === quote) {
      return i + 1;
    }
  }
  return input.length;
}

function blankRegex(out: string[], input: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === "[") {
      inClass = true;
    } else if (ch === "]") {
      inClass = false;
    } else if (ch === "/" && !inClass) {
      blankSpan(out, input, start + 1, i);
      return i + 1;
    } else if (ch === "\n") {
      return start + 1;
    }
  }
  return input.length;
}

function blankSpan(
  out: string[],
  input: string,
  start: number,
  end: number,
): void {
  for (let i = start; i < end && i < out.length; i += 1) {
    out[i] = input[i] === "\n" ? "\n" : " ";
  }
}

function opensRegex(input: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && /\s/.test(input[i]!)) {
    i -= 1;
  }
  if (i < 0) {
    return true;
  }
  return "([{=,:;!?&|+-*~^<>".includes(input[i]!);
}

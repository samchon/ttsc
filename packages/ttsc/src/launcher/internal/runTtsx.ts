import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { getCompilerVersionText } from "./getCompilerVersionText";
import { prepareExecution } from "./prepareExecution";
import { resolveCacheDir } from "./resolveCacheDir";

/**
 * CLI entry point for `ttsx`. Type-checks the owning project via tsgo, emits
 * JavaScript to a PID-isolated temp directory, rewrites ESM specifiers when
 * needed, and executes the compiled entry with the current Node.js runtime.
 *
 * @param argv - Command-line arguments (defaults to `process.argv.slice(2)`).
 * @returns The child-process exit code, or `2` on a ttsx-level error.
 */
export function runTtsx(
  argv: readonly string[] = process.argv.slice(2),
): number {
  try {
    return run(argv);
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

function run(argv: readonly string[]): number {
  const parsed = parseCLI(argv);
  if (parsed === "help") {
    printHelp();
    return 0;
  }
  if (parsed === "version") {
    process.stdout.write(
      `${getCompilerVersionText().replace(/^ttsc\b/, "ttsx")}\n`,
    );
    return 0;
  }

  const cwd = path.resolve(parsed.cwd ?? process.cwd());
  const entry = path.resolve(cwd, parsed.entry);
  if (!fs.existsSync(entry)) {
    process.stderr.write(`ttsx: entry not found: ${entry}\n`);
    return 2;
  }

  const prepared = prepareExecution(entry, {
    binary: parsed.binary,
    cacheDir: resolveCacheDir(cwd, parsed.cacheDir),
    cwd,
    project: parsed.project,
  });
  return runPreparedEntry(parsed, prepared, cwd);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseCLI(argv: readonly string[]) {
  const preload: string[] = [];
  const passthroughIndex = argv.indexOf("--");
  const head =
    passthroughIndex === -1 ? [...argv] : [...argv.slice(0, passthroughIndex)];
  const passthrough =
    passthroughIndex === -1 ? [] : [...argv.slice(passthroughIndex + 1)];

  let binary: string | undefined;
  let cacheDir: string | undefined;
  let cwd: string | undefined;
  let entry: string | undefined;
  let project: string | undefined;

  while (head.length !== 0) {
    const current = head.shift()!;
    if (entry) {
      passthrough.push(current, ...head);
      break;
    }
    switch (current) {
      case "-h":
      case "--help":
        return "help";
      case "-v":
      case "--version":
        return "version";
      case "-P":
      case "--project":
        project = takeValue(current, head);
        break;
      case "--cwd":
        cwd = takeValue(current, head);
        break;
      case "--cache-dir":
        cacheDir = takeValue(current, head);
        break;
      case "-r":
      case "--require":
        preload.push(takeValue(current, head));
        break;
      case "--binary":
        binary = takeValue(current, head);
        break;
      default:
        if (current.startsWith("--project=")) {
          project = current.slice("--project=".length);
        } else if (current.startsWith("--cwd=")) {
          cwd = current.slice("--cwd=".length);
        } else if (current.startsWith("--cache-dir=")) {
          cacheDir = current.slice("--cache-dir=".length);
        } else if (current.startsWith("--binary=")) {
          binary = current.slice("--binary=".length);
        } else if (current.startsWith("-")) {
          throw new Error(`ttsx: unknown option ${current}`);
        } else {
          entry = current;
        }
        break;
    }
  }

  if (!entry) {
    throw new Error("ttsx: entry file is required");
  }

  return {
    binary,
    cacheDir,
    cwd,
    entry,
    passthrough,
    preload,
    project,
  };
}

function printHelp(): void {
  process.stdout.write(
    [
      "ttsx — TypeScript runner provided by ttsc.",
      "",
      "Usage:",
      "  ttsx [options] <entry.ts> [-- <argv...>]",
      "",
      "Options:",
      "  -P, --project <file>   Use an explicit tsconfig.json",
      "  --cwd <dir>            Resolve entry/project relative to this directory",
      "  --cache-dir <dir>      Override the runner and source-plugin cache root",
      "  --binary <path>        Use an explicit tsgo binary",
      "  -r, --require <module> Preload a module before the entrypoint",
      "  -h, --help             Show this help",
      "  -v, --version          Print the runner version",
      "",
      "Examples:",
      "  ttsx src/index.ts",
      "  ttsx --project tsconfig.json src/index.ts -- --port 3000",
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function resolvePreload(cwd: string, preload: string): string {
  if (path.isAbsolute(preload) || isRelativeSpecifier(preload)) {
    return path.resolve(cwd, preload);
  }
  return preload;
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

function takeValue(flag: string, rest: string[]): string {
  const value = rest.shift();
  if (!value) {
    throw new Error(`ttsx: ${flag} requires a value`);
  }
  return value;
}

function runPreparedEntry(
  parsed: Exclude<ReturnType<typeof parseCLI>, "help" | "version">,
  execution: ReturnType<typeof prepareExecution>,
  cwd: string,
): number {
  fs.mkdirSync(execution.emitDir, { recursive: true });
  if (execution.moduleKind === "esm") {
    rewriteEsmSpecifiers(execution.emitDir);
    fs.writeFileSync(
      path.join(execution.emitDir, "package.json"),
      JSON.stringify({ type: "module" }),
      "utf8",
    );
  }
  const args = [
    ...parsed.preload.flatMap((preload) => [
      "-r",
      resolvePreload(cwd, preload),
    ]),
    execution.entryFile,
    ...parsed.passthrough,
  ];
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

/**
 * Walk every `.js`/`.mjs`/`.cjs` file in `root` and rewrite bare relative
 * specifiers (e.g. `"./foo"`) to include the resolved file extension so Node
 * can load them with `--input-type=module`. Files that did not change are not
 * written back.
 */
function rewriteEsmSpecifiers(root: string): void {
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      if (!entry.isFile() || !isJavaScriptOutput(next)) {
        continue;
      }
      const before = fs.readFileSync(next, "utf8");
      const after = rewriteEsmSpecifiersInText(next, before);
      if (after !== before) {
        fs.writeFileSync(next, after, "utf8");
      }
    }
  }
}

function rewriteEsmSpecifiersInText(fromFile: string, input: string): string {
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  scanEsmSpecifiers(fromFile, input, 0, input.length, replacements);
  if (replacements.length === 0) {
    return input;
  }
  let output = "";
  let last = 0;
  for (const replacement of replacements) {
    output += input.slice(last, replacement.start);
    output += replacement.text;
    last = replacement.end;
  }
  return output + input.slice(last);
}

function scanEsmSpecifiers(
  fromFile: string,
  input: string,
  start: number,
  end: number,
  replacements: Array<{ start: number; end: number; text: string }>,
): void {
  let i = start;
  while (i < end) {
    if (input[i] === "`") {
      i = scanTemplateExpressions(fromFile, input, i, replacements);
      continue;
    }
    const skipped = skipNonCode(input, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    if (isKeywordAt(input, i, "import")) {
      const next = skipWhitespace(input, i + "import".length);
      if (input[next] === "(") {
        rewriteDynamicImportSpecifier(fromFile, input, next, replacements);
      } else if (isQuote(input[next])) {
        rewriteStringSpecifier(fromFile, input, next, replacements);
      } else {
        rewriteFromSpecifier(fromFile, input, next, replacements);
      }
      i += "import".length;
      continue;
    }
    if (isKeywordAt(input, i, "export")) {
      rewriteFromSpecifier(fromFile, input, i + "export".length, replacements);
      i += "export".length;
      continue;
    }
    i += 1;
  }
}

function rewriteDynamicImportSpecifier(
  fromFile: string,
  input: string,
  openParen: number,
  replacements: Array<{ start: number; end: number; text: string }>,
): void {
  const specifier = skipWhitespace(input, openParen + 1);
  if (isQuote(input[specifier])) {
    rewriteStringSpecifier(fromFile, input, specifier, replacements);
  }
}

function rewriteFromSpecifier(
  fromFile: string,
  input: string,
  start: number,
  replacements: Array<{ start: number; end: number; text: string }>,
): void {
  let i = start;
  let depth = 0;
  while (i < input.length) {
    const skipped = skipNonCode(input, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const current = input[i]!;
    if (depth === 0 && current === ";") {
      return;
    }
    if (current === "{" || current === "[" || current === "(") {
      depth += 1;
      i += 1;
      continue;
    }
    if (current === "}" || current === "]" || current === ")") {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (depth === 0 && isKeywordAt(input, i, "from")) {
      const specifier = skipWhitespace(input, i + "from".length);
      if (isQuote(input[specifier])) {
        rewriteStringSpecifier(fromFile, input, specifier, replacements);
      }
      return;
    }
    i += 1;
  }
}

function rewriteStringSpecifier(
  fromFile: string,
  input: string,
  quoteIndex: number,
  replacements: Array<{ start: number; end: number; text: string }>,
): void {
  const literal = readSimpleStringLiteral(input, quoteIndex);
  if (literal === null) {
    return;
  }
  const next = withResolvableExtension(fromFile, literal.value);
  if (next === literal.value) {
    return;
  }
  replacements.push({
    start: literal.start,
    end: literal.end,
    text: next,
  });
}

function scanTemplateExpressions(
  fromFile: string,
  input: string,
  start: number,
  replacements: Array<{ start: number; end: number; text: string }>,
): number {
  for (let i = start + 1; i < input.length; i += 1) {
    const current = input[i]!;
    if (current === "\\") {
      i += 1;
      continue;
    }
    if (current === "`") {
      return i + 1;
    }
    if (current === "$" && input[i + 1] === "{") {
      const expressionStart = i + 2;
      const expressionEnd = findTemplateExpressionEnd(input, expressionStart);
      if (expressionEnd === null) {
        return input.length;
      }
      scanEsmSpecifiers(
        fromFile,
        input,
        expressionStart,
        expressionEnd,
        replacements,
      );
      i = expressionEnd;
    }
  }
  return input.length;
}

function findTemplateExpressionEnd(
  input: string,
  expressionStart: number,
): number | null {
  let depth = 1;
  for (let i = expressionStart; i < input.length; i += 1) {
    const skipped = skipNonCode(input, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }
    const current = input[i]!;
    if (current === "{") {
      depth += 1;
      continue;
    }
    if (current === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return null;
}

/**
 * Append or fix a file extension on a relative specifier so that Node's ESM
 * loader can resolve it. The resolution order mirrors Node's own algorithm:
 * exact file match → directory index → `.js` fallback. Non-relative specifiers
 * and already-extensioned paths are returned unchanged.
 */
function withResolvableExtension(fromFile: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    // Bare specifiers (packages, builtins) need no rewriting.
    return specifier;
  }
  if (/\.(?:[cm]?js|json|node)$/i.test(specifier)) {
    // Already has a concrete extension the loader understands.
    return specifier;
  }
  const [pathname, suffix = ""] = splitSpecifierSuffix(specifier);
  const fromDir = path.dirname(fromFile);
  // 1. Try the specifier as a file path with each JS extension.
  for (const extension of [".js", ".mjs", ".cjs"]) {
    if (fs.existsSync(path.resolve(fromDir, pathname + extension))) {
      return pathname + extension + suffix;
    }
  }
  // 2. Try interpreting it as a directory with an index file.
  const directory = pathname.replace(/\/+$/, "");
  for (const extension of [".js", ".mjs", ".cjs"]) {
    if (fs.existsSync(path.resolve(fromDir, directory, "index" + extension))) {
      return `${directory}/index${extension}${suffix}`;
    }
  }
  // 3. Last resort: append `.js` and let Node surface the error if it's wrong.
  return `${specifier}.js`;
}

function splitSpecifierSuffix(specifier: string): [string, string?] {
  const index = specifier.search(/[?#]/);
  if (index === -1) {
    return [specifier];
  }
  return [specifier.slice(0, index), specifier.slice(index)];
}

function isJavaScriptOutput(filename: string): boolean {
  return /\.(?:[cm]?js)$/i.test(filename);
}

function skipNonCode(input: string, start: number): number {
  const current = input[start];
  const next = input[start + 1];
  if (current === '"' || current === "'") {
    return skipString(input, start);
  }
  if (current === "`") {
    return skipTemplate(input, start);
  }
  if (current === "/" && next === "/") {
    return skipLineComment(input, start);
  }
  if (current === "/" && next === "*") {
    return skipBlockComment(input, start);
  }
  if (current === "/" && looksLikeRegexStart(input, start)) {
    return skipRegex(input, start);
  }
  return start;
}

function skipString(input: string, start: number): number {
  const quote = input[start]!;
  for (let i = start + 1; i < input.length; i += 1) {
    const current = input[i]!;
    if (current === "\\") {
      i += 1;
      continue;
    }
    if (current === quote) {
      return i + 1;
    }
  }
  return input.length;
}

function skipTemplate(input: string, start: number): number {
  for (let i = start + 1; i < input.length; i += 1) {
    const current = input[i]!;
    if (current === "\\") {
      i += 1;
      continue;
    }
    if (current === "`") {
      return i + 1;
    }
  }
  return input.length;
}

function skipLineComment(input: string, start: number): number {
  const end = input.indexOf("\n", start + 2);
  return end === -1 ? input.length : end + 1;
}

function skipBlockComment(input: string, start: number): number {
  const end = input.indexOf("*/", start + 2);
  return end === -1 ? input.length : end + 2;
}

function skipRegex(input: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < input.length; i += 1) {
    const current = input[i]!;
    if (current === "\\") {
      i += 1;
      continue;
    }
    if (current === "[") {
      inClass = true;
      continue;
    }
    if (current === "]") {
      inClass = false;
      continue;
    }
    if (current === "/" && !inClass) {
      i += 1;
      while (/[A-Za-z]/.test(input[i] ?? "")) {
        i += 1;
      }
      return i;
    }
  }
  return input.length;
}

/**
 * Determine whether the `/` at `start` opens a regex literal rather than a
 * division operator. This is a conservative approximation: check the preceding
 * non-whitespace token — if it is an operator character or a keyword that must
 * be followed by an expression, we assume regex.
 */
function looksLikeRegexStart(input: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && /\s/.test(input[i]!)) {
    i -= 1;
  }
  if (i < 0) {
    return true;
  }
  const previous = input[i]!;
  if ("([{=,:;!?&|+-*~^<>".includes(previous)) {
    return true;
  }
  const word = readPreviousWord(input, i);
  return /^(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await)$/.test(
    word,
  );
}

function readPreviousWord(input: string, end: number): string {
  let start = end;
  while (start >= 0 && isIdentifierPart(input[start]!)) {
    start -= 1;
  }
  return input.slice(start + 1, end + 1);
}

function readSimpleStringLiteral(
  input: string,
  quoteIndex: number,
): { start: number; end: number; value: string } | null {
  const quote = input[quoteIndex]!;
  for (let i = quoteIndex + 1; i < input.length; i += 1) {
    const current = input[i]!;
    if (current === "\\") {
      return null;
    }
    if (current === quote) {
      return {
        start: quoteIndex + 1,
        end: i,
        value: input.slice(quoteIndex + 1, i),
      };
    }
  }
  return null;
}

function skipWhitespace(input: string, start: number): number {
  let i = start;
  while (i < input.length && /\s/.test(input[i]!)) {
    i += 1;
  }
  return i;
}

function isKeywordAt(input: string, start: number, keyword: string): boolean {
  return (
    input.startsWith(keyword, start) &&
    !isIdentifierPart(input[start - 1] ?? "") &&
    !isIdentifierPart(input[start + keyword.length] ?? "")
  );
}

function isIdentifierPart(value: string): boolean {
  return /[$\p{ID_Continue}]/u.test(value);
}

function isQuote(value: string | undefined): value is '"' | "'" {
  return value === '"' || value === "'";
}

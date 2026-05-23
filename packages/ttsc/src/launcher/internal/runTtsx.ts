import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  getBoolean,
  getNumber,
  getString,
  parseFlags,
} from "../../flags/parser";
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
    checkers: parsed.checkers,
    cwd,
    passthrough: parsed.tsgoFlags,
    // `--no-plugins` builds the entry's owning project with plugin
    // discovery and loading disabled. ttsc's own config loaders use it
    // when they evaluate a `*.config.ts` through ttsx: that build only
    // needs to type-check and run the config file, so loading the host
    // project's transform/check plugins (`@nestia/core`, `typia`, …)
    // would be both wasteful and wrong — those plugins impose project
    // requirements (e.g. `strict` mode) the ephemeral config-loader
    // tsconfig deliberately does not satisfy.
    plugins: parsed.noPlugins ? false : undefined,
    project: parsed.project,
    singleThreaded: parsed.singleThreaded,
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
  // ttsx accepts ttsc-style flags plus its own `--no-plugins` / `--require`.
  // The shared schema engine recognises both; the engine returns positional
  // tokens (entry file + flag values that aren't `.ts`) and a passthrough
  // list mirroring the pre-schema behaviour.
  //
  // Order pin: ttsx accepts `-P` as an alias for `--project`. The schema
  // declares `-p` for ttsc; ttsx's lowercase shape would collide on `-p`
  // → `--tsconfig`, so the legacy `-P` (uppercase) is treated as `--project`
  // via a manual rewrite before the engine sees argv. We preserve the
  // historical behaviour and emit a structural error otherwise.
  const rewritten = argv.map((token) =>
    token === "-P"
      ? "--project"
      : token.startsWith("-P=")
        ? `--project=${token.slice("-P=".length)}`
        : token,
  );
  // Terminal flags (--help / --version) short-circuit before parsing so
  // ttsx prints help text even when the entry file is missing.
  for (const token of rewritten) {
    if (token === "-h" || token === "--help") return "help" as const;
    if (token === "-v" || token === "--version") return "version" as const;
  }
  const result = parseFlags({
    argv: rewritten,
    errorPrefix: "ttsx:",
    forwardAfterFirstPositional: true,
    honorDoubleDashSeparator: true,
    subcommand: "ttsx",
  });

  const entry = result.positional.find(looksLikeEntryFile);
  if (entry === undefined) {
    throw new Error("ttsx: entry file is required");
  }
  // With `forwardAfterFirstPositional: true` the parser reports
  // `result.positional` as just the entry, `result.passthrough` as flags
  // arriving BEFORE the entry (tsgo-forwarded), and `result.tail` as every
  // token AFTER the entry — those are the user program's argv (e.g. the
  // `generate --input src/input` tail of `ttsx typia.ts generate
  // --input src/input`) and MUST NOT reach tsgo. Anything in positional
  // that is not the entry is a pre-entry flag value (e.g. `--target es2020`)
  // that the parser stored positionally; forward those to tsgo with the
  // rest of `passthrough`.
  const preEntryValues: string[] = result.positional.filter(
    (token) => token !== entry && !looksLikeEntryFile(token),
  );
  const postEntryArgs: string[] = [...result.tail];

  const preload: string[] = [];
  // `--require` accepts repeated values; the schema engine writes the
  // LAST one into `values`, so reconstruct the full list by scanning the
  // raw argv. Mirrors the legacy parser's `preload.push(takeValue(...))`
  // behaviour.
  //
  // Stop the rescue scan at the first token that begins tail mode —
  // either the entry file or the `--` separator. Without this guard,
  // `ttsx entry.ts -r preload.cjs` would BOTH preload `preload.cjs` AND
  // forward `-r preload.cjs` to the entry's argv, double-effecting the
  // module load. The schema engine already routes post-entry tokens to
  // `result.tail`; the rescue scan must respect the same boundary.
  const scanEnd = rewritten.findIndex(
    (token) => looksLikeEntryFile(token) || token === "--",
  );
  const scanLimit = scanEnd === -1 ? rewritten.length : scanEnd;
  for (let i = 0; i < scanLimit; i += 1) {
    const token = rewritten[i]!;
    if (token === "-r" || token === "--require") {
      const value = rewritten[i + 1];
      if (value !== undefined && !value.startsWith("-")) {
        preload.push(value);
        i += 1;
      }
    } else if (token.startsWith("--require=")) {
      preload.push(token.slice("--require=".length));
    }
  }

  return {
    binary: getString(result, "--binary"),
    cacheDir: getString(result, "--cache-dir"),
    checkers: getNumber(result, "--checkers"),
    cwd: getString(result, "--cwd"),
    entry,
    noPlugins: getBoolean(result, "--no-plugins") === true,
    passthrough: postEntryArgs,
    preload,
    project: getString(result, "--tsconfig"),
    singleThreaded: getBoolean(result, "--singleThreaded") === true,
    tsgoFlags: [...result.passthrough, ...preEntryValues],
  };
}

/**
 * Report whether a bare CLI token is the TypeScript entry file rather than a
 * forwarded flag's value. ttsx runs a TypeScript entrypoint, so only a token
 * with a TypeScript source extension is treated as the entry.
 */
function looksLikeEntryFile(token: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));
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
      "  --no-plugins           Build the project without ttsc plugins",
      "  -r, --require <module> Preload a module before the entrypoint",
      "  --singleThreaded       Run TypeScript-Go single-threaded (one checker)",
      "  --checkers <n>         Type-checker pool size (default: TypeScript-Go's)",
      "  -h, --help             Show this help",
      "  -v, --version          Print the runner version",
      "",
      "  Any other flag before the entry is forwarded to tsgo, so options like",
      "  --strict apply to the type-check (e.g. ttsx --strict src/index.ts).",
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

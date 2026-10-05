import { getBoolean } from "../../flags/getBoolean";
import { getNumber } from "../../flags/getNumber";
import { getString } from "../../flags/getString";
import { getStringList } from "../../flags/getStringList";
import { parseFlags } from "../../flags/parseFlags";
import { readCompilerOptionOccurrence } from "../../flags/readCompilerOptionOccurrence";
import { resolveFlagSpec } from "../../flags/resolveFlagSpec";
import { assertNoSolutionBuild } from "./assertNoSolutionBuild";

/**
 * Parse ttsx options while preserving the program's own argument boundary.
 *
 * Compiler flags before the first entry, repeated preloads and launcher-owned
 * settings are separated once through the shared flag schema. Terminal requests
 * are recognized only before the entry; unsupported watch/build requests fail
 * before a compiler or program is started. These decisions inspect the supplied
 * argv frame; this parser does not read response-file contents or certify their
 * eventual native effects.
 *
 * @param argv Command tokens as received from the launcher.
 * @returns A terminal request or the launcher's typed option record.
 * @evidence contracts/common.md#principled-implementation The shared schema owns option arity and first-positional/tail boundaries; terminal requests use that same flag resolution, with a schema-derived prefix scan only when parsing itself fails.
 * @evidence contracts/common.md#clear-and-simple-design One pure launcher option boundary owns value projection, repeatable preloads and build/watch rejection, delegating schema mechanics rather than rescanning entry extensions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Accepted spellings follow the actual flag schema/compiler option kinds, not source extensions or consumer-specific rewrites; unsupported modes throw their supported diagnostics.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain compiler/program separation, terminal precedence and early rejection; private helper comments state why the failed-parse prefix scan exists.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This function classifies argument tokens without resolving filesystem paths or starting processes; native representations remain with its launcher caller.
 * @evidence contracts/performance.md#efficient-algorithms Shared parsing and fixed-count terminal/watch scans advance through at most the supplied argv frame and its parsed projections. Delegated token normalization and native operand lookahead also cost time and transient space proportional to the text they inspect; repeated preloads and tail/compiler snapshots add at most O(A) argument references. The failure-only prefix scan advances by each owning option's width without reparsing program-tail tokens.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each pure option parse belongs to one invocation; it coordinates no completed or in-flight shared work and has no historical result cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Local arrays and the returned option record transfer to the caller; this parser owns no retained state, directory, handle or task.
 */
export function parseTtsxCLI(argv: readonly string[]) {
  // ttsx accepts ttsc-style flags plus its own `--no-plugins` / `--require`.
  // The shared schema engine recognises both; after empty/response-token rules,
  // it returns the first unconsumed bare token as the entry, earlier flags/values as compiler
  // passthrough and later tokens as the program tail, regardless of extension.
  //
  // The legacy uppercase `-P` spelling ttsx has always accepted needs no
  // rewrite: the engine resolves a token to the flag the compiler resolves it
  // to, so `-P` and `-P=<file>` reach `--tsconfig` by the same rule that makes
  // `-p` reach it. A textual pre-rewrite here would be a second rule for a job
  // the engine owns.
  //
  // Terminal flags (--help / --version) belong to ttsx only before the entry;
  // after it they are the program's own argv, exactly as `node entry.js
  // --version` hands `--version` to the program. The
  // parser already draws that boundary, so they are read off its result, and
  // resolved through the schema so every spelling the compiler accepts
  // (`--HELP`, `-Version`) reaches the same branch.
  let result: ReturnType<typeof parseFlags>;
  try {
    result = parseFlags({
      argv,
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      // After empty/response-token handling, the entry is the first bare token
      // that is no option's value, whatever its extension: the schema and the
      // compiler's own option table say
      // which options take a value (the `es2020` of `--target es2020`), so a
      // JavaScript entry is the entry too rather than a forwarded value.
      subcommand: "ttsx",
    });
  } catch (error) {
    // Help still prints when the other options do not parse, as long as it was
    // asked for before anything that looks like the entry.
    const terminal = terminalRequest(argv.slice(0, firstPositionalIndex(argv)));
    if (terminal !== null) return terminal;
    throw error;
  }
  // Parsed launcher identities are not argv: a scalar key carries no value
  // here, so joining it to the next key would invent an operand boundary.
  let terminal: "help" | "version" | null = null;
  for (const key of result.values.keys()) {
    if (key === "--help") {
      terminal = "help";
      break;
    }
    if (key === "--version") {
      terminal = "version";
      break;
    }
  }
  terminal ??= terminalRequest(result.passthrough);
  if (terminal !== null) return terminal;
  assertNoSolutionBuild(result, "ttsx:");
  assertNoWatch(result);

  const entry = result.positional[0];
  if (entry === undefined) {
    throw new Error("ttsx: entry file is required");
  }
  // With `forwardAfterFirstPositional: true`, the parser reports
  // `result.positional` as just the entry, `result.passthrough` as the
  // tsgo-forwarded flags (and their in-order space values) arriving BEFORE the
  // entry, and `result.tail` as every token AFTER the entry — the user
  // program's argv (e.g. the `generate --input src/input` tail of `ttsx
  // typia.ts generate --input src/input`), which MUST NOT reach tsgo.
  const postEntryArgs: string[] = [...result.tail];

  // `--require` is declared `repeatable`, so the engine records every accepted
  // value in argv order and the launcher reads the list straight off the parse
  // result.
  //
  // Preload values may themselves carry TypeScript extensions, so entry
  // classification must follow option arity rather than an extension scan.
  // The engine owns that boundary:
  // `forwardAfterFirstPositional` routes every post-entry token to
  // `result.tail` without parsing it, so `ttsx entry.ts -r preload.cjs` still
  // forwards the pair to the program instead of preloading it.
  const preload = getStringList(result, "--require");

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
    tsgoFlags: [...result.passthrough],
  };
}

/**
 * `"help"` or `"version"` when one of `tokens` asks for it, else `null`. Only
 * dash-prefixed tokens can name a flag; a bare value such as the `all` of
 * `--target all` must not read as `--all`.
 */
function terminalRequest(tokens: readonly string[]): "help" | "version" | null {
  for (let index = 0; index < tokens.length; ) {
    const token = tokens[index]!;
    const flag = resolveFlagSpec(token)?.name;
    if (flag === "--help") return "help";
    if (flag === "--version") return "version";
    index += ttsxOptionWidth(tokens, index);
  }
  return null;
}

/**
 * Index of the first nonempty, non-response bare token that is no option's
 * value, or the length. Used only where the parser itself failed, to still find
 * the options before the entry.
 */
function firstPositionalIndex(argv: readonly string[]): number {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token.startsWith("@")) continue;
    if (token === "") continue;
    if (!token.startsWith("-")) return index;
    if (token.includes("=")) continue;
    index += ttsxOptionWidth(argv, index) - 1;
  }
  return argv.length;
}

/**
 * Refuse `--watch` (or `-w`) given to ttsx itself, before any compiler starts.
 *
 * Forwarded to the type-check, it turned the check into a process that never
 * returns, so the entry never ran and the command hung with no output. ttsx
 * runs the entry once after one check, and a watch that restarts the program is
 * a different feature; the message names the two tools that already provide the
 * halves. A `--watch` after the entry is the program's own flag and never
 * reaches here.
 */
function assertNoWatch(result: ReturnType<typeof parseFlags>): void {
  let watching = result.values.has("--watch");
  for (let index = 0; !watching && index < result.passthrough.length; ) {
    watching = resolveFlagSpec(result.passthrough[index]!)?.name === "--watch";
    index += readCompilerOptionOccurrence(result.passthrough, index).width;
  }
  if (!watching) return;
  throw new Error(
    "ttsx: --watch is not supported; ttsx type-checks once and then runs the entry. For a watching type-check use `ttsc --watch --noEmit`; to restart the program on changes use `node --watch --require ttsc/register <entry.ts>`. Arguments after the entry, including --watch, go to the program.",
  );
}

/**
 * Launcher values keep their missing-value policy; forwarded options use native
 * grammar.
 */
function ttsxOptionWidth(argv: readonly string[], index: number): 1 | 2 {
  const token = argv[index]!;
  if (token.includes("=")) return 1;
  const flag = resolveFlagSpec(token);
  if (
    flag?.consumedBy.includes("launcher") === true &&
    flag.subcommands.includes("ttsx")
  ) {
    const next = argv[index + 1];
    if (next === undefined) return 1;
    if (flag.kind === "boolean")
      return next === "true" || next === "false" ? 2 : 1;
    return next.startsWith("-") ? 1 : 2;
  }
  return readCompilerOptionOccurrence(argv, index).width;
}

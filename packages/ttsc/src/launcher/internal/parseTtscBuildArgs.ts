import { getBoolean } from "../../flags/getBoolean";
import { getNumber } from "../../flags/getNumber";
import { getString } from "../../flags/getString";
import { parseFlags } from "../../flags/parseFlags";
import { assertNoSolutionBuild } from "./assertNoSolutionBuild";

/**
 * Parse launcher build arguments without resolving a project or starting a host.
 *
 * @evidence contracts/common.md#principled-implementation Reuses the existing schema parser and solution-build guard, preserving tri-state emit precedence and forwarded argument order from the original launcher closure.
 * @evidence contracts/common.md#clear-and-simple-design One authored adapter returns launcher-owned values; its two local helpers only resolve emit precedence and identify source extensions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown compiler flags and adjacent values remain in original order; invalid owned values use the schema errors without coercion or fake compiler execution.
 * @evidence contracts/common.md#meaningful-documentation The comment states the execution-free parser boundary; inline comments retain the default quiet, emit and positional-file decisions.
 * @evidence contracts/performance.md#efficient-algorithms One linear argv parse and copies of its positional and passthrough lists bound work and temporary space by argument count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation owns different argv; this parser coordinates no shared computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned options are invocation values; no retained memo, process or handle is acquired.
 */
export function parseTtscBuildArgs(argv: readonly string[]) {
  const result = parseFlags({
    argv,
    errorPrefix: "ttsc:",
    // A bare token is a single-file input only when it carries a TypeScript
    // source extension; any other bare token is the space-separated value of a
    // preceding forwarded flag (e.g. the `es2020` in `--target es2020`). The
    // parser routes those values into `passthrough` in place, so the forwarded
    // flag/value pairs reach tsgo in their original order.
    isPositional: looksLikeInputFile,
    subcommand: "build",
  });
  assertNoSolutionBuild(result, "ttsc:");
  // Defaults: pinned by the previous hand-parser. `quiet` defaults true,
  // `--verbose` flips it to false; `emit` defaults `undefined` so the resolved
  // project controls ordinary build mode. `runCompatibleBuild` applies the
  // check/fix/format no-emit decision before either execution lane runs.
  const verbose = getBoolean(result, "--verbose");
  const quietFlag = getBoolean(result, "--quiet");
  const quiet = verbose === true ? false : (quietFlag ?? true);
  const explicitEmit = getBoolean(result, "--emit");
  const explicitNoEmit = getBoolean(result, "--noEmit");
  const emit = resolveExplicitEmit(explicitEmit, explicitNoEmit);

  // `isPositional: looksLikeInputFile` guarantees every `result.positional`
  // token is a TypeScript input file; forwarded flag values already live in
  // `result.passthrough` in their original order, so no reconstruction is
  // needed here (the previous `[...passthrough, ...trailingValues]` concat
  // reordered every flag ahead of every value).
  const files = [...result.positional];
  const passthrough = [...result.passthrough];

  return {
    binary: getString(result, "--binary"),
    cacheDir: getString(result, "--cache-dir"),
    checkers: getNumber(result, "--checkers"),
    cwd: getString(result, "--cwd"),
    emit,
    files,
    fix: false,
    format: false,
    outDir: getString(result, "--outDir"),
    passthrough,
    preserveWatchOutput: getBoolean(result, "--preserveWatchOutput") === true,
    quiet,
    singleThreaded: getBoolean(result, "--singleThreaded") === true,
    tsconfig: getString(result, "--tsconfig"),
    watch: getBoolean(result, "--watch") === true,
  };
}

/**
 * Collapse the two launcher-owned emit switches into the tri-state consumed by
 * `runBuild` and the single-file lane. A specified boolean is significant even
 * when it is `false`: `--emit=false` is analysis-only and `--noEmit=false`
 * explicitly overrides a project's `noEmit`. `--emit` retains precedence when
 * callers supply both switches, matching the legacy true-only resolution.
 *
 */
function resolveExplicitEmit(
  explicitEmit: boolean | undefined,
  explicitNoEmit: boolean | undefined,
): boolean | undefined {
  if (explicitEmit !== undefined) return explicitEmit;
  return explicitNoEmit === undefined ? undefined : !explicitNoEmit;
}

/**
 * Report whether a bare CLI token is a TypeScript source file ttsc should
 * compile in single-file mode. Anything without a TypeScript source extension
 * is treated as a forwarded flag value rather than an input file.
 *
 */
function looksLikeInputFile(token: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));
}

// Schema-driven CLI parser used by both `runTtsc.ts` and `runTtsx.ts`.
//
// One engine, one schema. Each subcommand picks the subset of FLAG_SCHEMA it
// accepts and feeds it through `parseFlags`. The engine returns:
//
//   * `values`      — typed values for every consumed flag.
//   * `passthrough` — flags ttsc did not consume but must forward verbatim
//                     to tsgo (or to native sidecars via `--tsgo-args`).
//   * `positional`  — bare non-flag tokens (file paths, entry files, …).
//
// The schema is the spec; behaviour at every layer boundary is determined by
// the FlagSpec attributes, not by ad-hoc `if (arg === "--foo")` branches.

import type {
  AnySubcommand,
  FlagSpec,
  ValueValidator,
} from "./schema";
import { FLAG_BY_NAME, flagsForSubcommand } from "./schema";

/**
 * Per-subcommand parse result. `values` is keyed by the canonical flag
 * name (e.g. `"--singleThreaded"`); boolean flags resolve to `true`/`false`,
 * value flags to the parsed value type. Callers narrow with the helpers
 * below (`getBoolean`, `getString`, `getNumber`).
 */
export interface ParseResult {
  /** Canonical flag name → resolved value. */
  readonly values: ReadonlyMap<string, string | boolean | number>;
  /** Flags the engine did not consume — forwarded to tsgo. */
  readonly passthrough: readonly string[];
  /** Bare non-flag positional arguments, in original order. */
  readonly positional: readonly string[];
}

/**
 * Options controlling a single `parseFlags` invocation.
 */
export interface ParseOptions {
  /** Which subcommand's flag subset to accept. */
  readonly subcommand: AnySubcommand;
  /** Argv tail (the launcher has already split off the subcommand). */
  readonly argv: readonly string[];
  /**
   * Error prefix used when the parser throws (`"ttsc:"` or `"ttsx:"`). The
   * engine itself is product-neutral; the caller controls the brand.
   */
  readonly errorPrefix: string;
  /**
   * `true` to treat the FIRST positional token as a sentinel that switches
   * the engine to "forward everything after" mode (ttsx's entry-file
   * behaviour: tokens after the entry are runtime argv, not tsgo flags).
   * The sentinel itself is still recorded as a positional argument.
   */
  readonly forwardAfterFirstPositional?: boolean;
  /**
   * Optional `"--"` separator handling: when present in argv, every token
   * after `--` is appended to `passthrough` as-is (ttsx already does this).
   */
  readonly honorDoubleDashSeparator?: boolean;
}

/**
 * Parse `argv` according to FLAG_SCHEMA filtered by `subcommand`. Returns a
 * `ParseResult`. Throws `Error` (with the configured prefix) on invalid
 * input — unknown subcommand-only flag, missing required value, value that
 * fails its validator.
 */
export function parseFlags(opts: ParseOptions): ParseResult {
  const accepted = new Map<string, FlagSpec>();
  for (const flag of flagsForSubcommand(opts.subcommand)) {
    accepted.set(flag.name, flag);
    for (const alias of flag.aliases ?? []) accepted.set(alias, flag);
  }

  const values = new Map<string, string | boolean | number>();
  const passthrough: string[] = [];
  const positional: string[] = [];

  let remainder: string[] | null = null;
  if (opts.honorDoubleDashSeparator === true) {
    const separator = opts.argv.indexOf("--");
    if (separator !== -1) {
      remainder = [...opts.argv.slice(separator + 1)];
    }
  }
  const head: string[] = [
    ...(remainder === null ? opts.argv : opts.argv.slice(0, indexOfSeparator(opts.argv))),
  ];

  let forwardingTail = false;
  while (head.length !== 0) {
    const current = head.shift()!;
    if (forwardingTail) {
      passthrough.push(current);
      continue;
    }

    // `--foo=value` form: split before resolving against the schema.
    const equalsIndex = current.startsWith("--") ? current.indexOf("=") : -1;
    const token = equalsIndex === -1 ? current : current.slice(0, equalsIndex);
    const inlineValue =
      equalsIndex === -1 ? undefined : current.slice(equalsIndex + 1);

    const flag = accepted.get(token);
    if (flag !== undefined) {
      consumeFlag(values, flag, token, inlineValue, head, opts.errorPrefix);
      continue;
    }

    // Token IS a known flag but is not accepted by THIS subcommand. The
    // engine forwards it to tsgo just like an unknown flag — the same
    // policy the legacy `parseBuildArgs` applied (RC-1 prevention).
    const globalFlag = FLAG_BY_NAME.get(token);
    if (globalFlag !== undefined) {
      forwardKnownButUnaccepted(
        passthrough,
        globalFlag,
        current,
        token,
        inlineValue,
        head,
      );
      continue;
    }

    // Truly unknown `-`-prefixed token: forward to tsgo verbatim. This
    // is what makes `ttsc --strict file.ts` work — ttsc does not need to
    // re-implement every tsgo flag.
    if (current.startsWith("-")) {
      passthrough.push(current);
      continue;
    }

    // Bare token: positional argument (file / entry / project path).
    positional.push(current);
    if (
      opts.forwardAfterFirstPositional === true &&
      positional.length === 1
    ) {
      forwardingTail = true;
    }
  }

  if (remainder !== null) {
    for (const token of remainder) passthrough.push(token);
  }

  return { values, passthrough, positional };
}

/**
 * Pull the value for `flag` from either `inlineValue` (`--flag=value`) or
 * the next argv token (`--flag value`), validate it per the schema, and
 * write it to the result map.
 */
function consumeFlag(
  values: Map<string, string | boolean | number>,
  flag: FlagSpec,
  token: string,
  inlineValue: string | undefined,
  rest: string[],
  errorPrefix: string,
): void {
  if (flag.kind === "boolean") {
    if (inlineValue === undefined) {
      values.set(flag.name, true);
      return;
    }
    // `--flag=false` form support: matches the legacy parser's behaviour
    // (e.g. `--singleThreaded=false`).
    values.set(flag.name, inlineValue !== "false");
    return;
  }

  const raw =
    inlineValue !== undefined ? inlineValue : takeValueToken(token, rest, errorPrefix);
  if (flag.validator === "positiveInt") {
    values.set(flag.name, validatePositiveInt(token, raw, errorPrefix));
    return;
  }
  values.set(flag.name, raw);
}

/**
 * Read the value token that follows `flag`. Throws if argv ends here.
 */
function takeValueToken(
  flag: string,
  rest: string[],
  errorPrefix: string,
): string {
  const value = rest.shift();
  if (value === undefined) {
    throw new Error(`${errorPrefix} ${flag} requires a value`);
  }
  return value;
}

/**
 * Validate a `positiveInt` value. Mirrors tsgo's `--checkers minValue:1`
 * constraint so a typo fails loudly at the launcher rather than reaching
 * tsgo with an invalid argument.
 */
function validatePositiveInt(
  flag: string,
  raw: string,
  errorPrefix: string,
): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `${errorPrefix} ${flag} expects a positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

/**
 * Forward a flag the schema knows about but the current subcommand does
 * not accept. The launcher will hand it to tsgo (or to native sidecars
 * via `--tsgo-args`); without this branch the parser would lose the
 * value token of a `--flag value` pair.
 */
function forwardKnownButUnaccepted(
  passthrough: string[],
  flag: FlagSpec,
  original: string,
  token: string,
  inlineValue: string | undefined,
  rest: string[],
): void {
  passthrough.push(original);
  // Boolean flags carry no value. `--foo=value` already encodes the value
  // inline. Otherwise the next argv token is the flag's value: keep it
  // adjacent so tsgo receives the pair intact.
  if (flag.kind === "boolean" || inlineValue !== undefined) {
    return;
  }
  if (rest.length === 0) return;
  if (rest[0]!.startsWith("-")) return;
  passthrough.push(rest.shift()!);
  void token; // unused; kept for symmetry with consumeFlag's signature
}

/**
 * Return the index of the `--` separator in `argv`, or `argv.length` when
 * absent. The parser slices on this index when honorDoubleDashSeparator.
 */
function indexOfSeparator(argv: readonly string[]): number {
  const index = argv.indexOf("--");
  return index === -1 ? argv.length : index;
}

// -----------------------------------------------------------------------------
// Typed accessors. The parser stores raw values (string | boolean | number) so
// the engine stays untyped; callers pick the shape per flag.
// -----------------------------------------------------------------------------

/** Return the boolean value of `flag` or `undefined` if not present. */
export function getBoolean(
  result: ParseResult,
  flag: string,
): boolean | undefined {
  const value = result.values.get(flag);
  if (typeof value === "boolean") return value;
  return undefined;
}

/** Return the string value of `flag` or `undefined` if not present. */
export function getString(
  result: ParseResult,
  flag: string,
): string | undefined {
  const value = result.values.get(flag);
  if (typeof value === "string") return value;
  return undefined;
}

/** Return the numeric value of `flag` or `undefined` if not present. */
export function getNumber(
  result: ParseResult,
  flag: string,
): number | undefined {
  const value = result.values.get(flag);
  if (typeof value === "number") return value;
  return undefined;
}

/** Marker type so docs callers can name the validator without an import dance. */
export type { ValueValidator };

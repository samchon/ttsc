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
  /**
   * Tokens that arrived after the `forwardAfterFirstPositional` sentinel.
   * These are intended for the user's program (e.g. ttsx's entry-file argv);
   * they are NOT forwarded to tsgo. Always empty when
   * `forwardAfterFirstPositional` is false.
   */
  readonly tail: readonly string[];
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
    // A flag enters the launcher's `accepted` set only when its
    // `consumedBy` includes `"launcher"`. Flags consumed solely by tsgo
    // or by native sidecars (e.g. `--showConfig`, `--listFilesOnly`)
    // must fall through to `forwardKnownButUnaccepted` so the launcher
    // forwards them verbatim instead of storing them in `values` where
    // no consumer reads them back out. The previous shape — filter on
    // `subcommands` only — silently dropped every tsgo-only terminal
    // flag at the launcher boundary (the RC-1 / RC-2 class the schema
    // is meant to make impossible).
    if (!flag.consumedBy.includes("launcher")) continue;
    accepted.set(flag.name, flag);
    for (const alias of flag.aliases ?? []) accepted.set(alias, flag);
  }

  const values = new Map<string, string | boolean | number>();
  const passthrough: string[] = [];
  const positional: string[] = [];
  const tail: string[] = [];

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
      // Post-sentinel tokens belong to the user's program (e.g. the typia.ts
      // entry's own argv: `ttsx typia.ts generate --input X`). They MUST NOT
      // be forwarded to tsgo — the caller distinguishes `tail` from
      // `passthrough` so script args never reach tsgo's option parser.
      tail.push(current);
      continue;
    }

    // `--foo=value` / `-p=value` form: split before resolving against the
    // schema. Both long (`--foo`) and short (`-p`) aliases support the
    // inline-value shape — without splitting the short form, `-p=value`
    // would fall through as an unknown token and be forwarded to tsgo,
    // bypassing the launcher's own consumer (e.g. plugin discovery against
    // the wrong project root).
    const equalsIndex = current.startsWith("-") ? current.indexOf("=") : -1;
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
    // policy the bare-lane parser applied (RC-1 prevention).
    const globalFlag = FLAG_BY_NAME.get(token);
    if (globalFlag !== undefined) {
      forwardKnownButUnaccepted(
        passthrough,
        globalFlag,
        current,
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
    // `--` separator: everything after goes to the user program when we are
    // in tail mode (ttsx after the entry), otherwise to tsgo as passthrough.
    const sink = forwardingTail ? tail : passthrough;
    for (const token of remainder) sink.push(token);
  }

  return { values, passthrough, positional, tail };
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
    if (inlineValue !== undefined) {
      // `--flag=false` / `--flag=true` inline form. Anything other than
      // a recognised literal stays loud: `--singleThreaded=yes` silently
      // becoming `true` is the kind of footgun the RCA's RC-4 class
      // covers. Mirrors `validatePositiveInt`'s style.
      const literal = parseBooleanLiteral(inlineValue);
      if (literal === undefined) {
        throw new Error(
          `${errorPrefix} ${token} expects \`true\` or \`false\`, got ${JSON.stringify(
            inlineValue,
          )}`,
        );
      }
      values.set(flag.name, literal);
      return;
    }
    // Space form `--flag true` / `--flag false`: peek the next token and
    // consume it only when it parses as a boolean literal. tsgo accepts
    // this shape natively; the launcher must mirror it so `ttsc --noEmit
    // false` does not corrupt argv (positional sink getting `false`,
    // tsgo seeing it as a stray input file).
    if (rest.length > 0) {
      const peek = parseBooleanLiteral(rest[0]!);
      if (peek !== undefined) {
        rest.shift();
        values.set(flag.name, peek);
        return;
      }
    }
    values.set(flag.name, true);
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
 * Read the value token that follows `flag`. Throws if argv ends here OR if
 * the next token looks like another flag (`-` prefix). Without the
 * "looks like a flag" guard `ttsc --cwd --strict src/main.ts` would silently
 * consume `--strict` as the value of `--cwd`, leaving `--strict` lost and
 * `cwd` set to a junk path. Mirrors the symmetric guard already in
 * `forwardKnownButUnaccepted` (RC-1 fairness — the two value-resolution
 * paths must agree on what counts as "a missing value").
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
  if (value.startsWith("-")) {
    // Put it back so the next loop iteration parses it as its own flag.
    rest.unshift(value);
    throw new Error(
      `${errorPrefix} ${flag} requires a value (next token ${JSON.stringify(
        value,
      )} starts with "-")`,
    );
  }
  return value;
}

/**
 * Parse a CLI boolean literal — `true`/`false` only (case-sensitive to
 * match tsgo's parser). Returns `undefined` for any other token so the
 * caller knows to throw or treat as a non-value.
 */
function parseBooleanLiteral(raw: string): boolean | undefined {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
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

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
import type { AnySubcommand, FlagSpec, ValueValidator } from "./schema";
import {
  flagsForSubcommand,
  normalizeFlagToken,
  resolveFlagSpec,
} from "./schema";

/**
 * Per-subcommand parse result. `values` is keyed by the canonical flag name
 * (e.g. `"--singleThreaded"`); boolean flags resolve to `true`/`false`, value
 * flags to the parsed value type. Callers narrow with the helpers below
 * (`getBoolean`, `getString`, `getNumber`).
 */
export interface ParseResult {
  /** Canonical flag name → resolved value. */
  readonly values: ReadonlyMap<string, string | boolean | number>;
  /**
   * Canonical flag name → every accepted value, in argv order. Populated only
   * for flags declared `repeatable` in `FLAG_SCHEMA` (`ttsx -r a -r b`), where
   * the last-value-wins `values` entry is not the whole answer. Read it through
   * `getStringList`.
   */
  readonly repeated: ReadonlyMap<
    string,
    readonly (string | boolean | number)[]
  >;
  /** Flags the engine did not consume — forwarded to tsgo. */
  readonly passthrough: readonly string[];
  /** Bare non-flag positional arguments, in original order. */
  readonly positional: readonly string[];
  /**
   * Tokens that arrived after the `forwardAfterFirstPositional` sentinel. These
   * are intended for the user's program (e.g. ttsx's entry-file argv); they are
   * NOT forwarded to tsgo. Always empty when `forwardAfterFirstPositional` is
   * false.
   */
  readonly tail: readonly string[];
}

/** Options controlling a single `parseFlags` invocation. */
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
   * `true` to treat the FIRST positional token as a sentinel that switches the
   * engine to "forward everything after" mode (ttsx's entry-file behaviour:
   * tokens after the entry are runtime argv, not tsgo flags). The sentinel
   * itself is still recorded as a positional argument.
   */
  readonly forwardAfterFirstPositional?: boolean;
  /**
   * Optional `"--"` separator handling: when present in argv, every token after
   * `--` is appended to `passthrough` as-is (ttsx already does this).
   */
  readonly honorDoubleDashSeparator?: boolean;
  /**
   * Classifies a bare (non-dash) token as a genuine positional argument (a
   * source file, the ttsx entry, a project path) rather than the
   * space-separated value of a preceding forwarded flag.
   *
   * When omitted, every bare token is a positional — the historical behaviour
   * for project-shaped subcommands that never forward `--flag value` pairs.
   *
   * When provided, a bare token that fails the predicate is appended to
   * `passthrough` in its original position instead of `positional`, so an
   * unknown `--flag value` pair reaches tsgo with its adjacency and relative
   * order intact. The parser deliberately does not guess a forwarded flag's
   * arity from the flag itself (it has no schema for a truly unknown flag); the
   * predicate is the only signal that separates a forwarded value from a real
   * input file, and both callers key it on the TypeScript source extension.
   *
   * Every path that can move a bare token out of `positional` consults it: the
   * main loop below and `forwardKnownButUnaccepted`, which answers the same
   * question for a schema-known flag this subcommand does not accept.
   */
  readonly isPositional?: (token: string) => boolean;
}

/**
 * Parse `argv` according to FLAG_SCHEMA filtered by `subcommand`. Returns a
 * `ParseResult`. Throws `Error` (with the configured prefix) on invalid input —
 * unknown subcommand-only flag, missing required value, value that fails its
 * validator.
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
    accepted.set(normalizeFlagToken(flag.name), flag);
    for (const alias of flag.aliases ?? []) {
      accepted.set(normalizeFlagToken(alias), flag);
    }
  }

  const values = new Map<string, string | boolean | number>();
  const repeated = new Map<string, (string | boolean | number)[]>();
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
    ...(remainder === null
      ? opts.argv
      : opts.argv.slice(0, indexOfSeparator(opts.argv))),
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

    // Only a `-`-prefixed token can name a flag. Bare tokens are input files
    // and flag values; resolving one against the schema would let the `all` of
    // `--target all` masquerade as `--all` now that the lookup is dash- and
    // case-insensitive.
    if (current.startsWith("-")) {
      // Split `--foo=value` / `-p=value` before resolving launcher-owned
      // options. A tsgo-only option is still forwarded byte-for-byte; pinned
      // tsgo does not split `=`, so it will reject that spelling itself.
      const equalsIndex = current.indexOf("=");
      const token =
        equalsIndex === -1 ? current : current.slice(0, equalsIndex);
      const inlineValue =
        equalsIndex === -1 ? undefined : current.slice(equalsIndex + 1);

      // Resolution is by flag identity, not by exact spelling: `--NOEMIT` and
      // `-noEmit` are the same option to the compiler ttsc forwards to, so they
      // must be the same option here. Otherwise a case variant of a ttsc-owned
      // flag falls through to the escape hatch below and tsgo honours it while
      // every ttsc-side consumer stays silent.
      const flag = accepted.get(normalizeFlagToken(token));
      if (flag !== undefined) {
        consumeFlag(
          values,
          repeated,
          flag,
          token,
          inlineValue,
          head,
          opts.errorPrefix,
        );
        continue;
      }

      // Token IS a known flag but is not accepted by THIS subcommand. The
      // engine forwards it to tsgo just like an unknown flag — the same
      // policy the bare-lane parser applied (RC-1 prevention).
      const globalFlag = resolveFlagSpec(token);
      if (globalFlag !== undefined) {
        forwardKnownButUnaccepted(
          passthrough,
          globalFlag,
          current,
          inlineValue,
          head,
          opts.isPositional,
        );
        continue;
      }

      // Truly unknown `-`-prefixed token: forward to tsgo verbatim. This
      // is what makes `ttsc --strict file.ts` work — ttsc does not need to
      // re-implement every tsgo flag.
      passthrough.push(current);
      continue;
    }

    // Bare token: either a genuine positional argument (file / entry / project
    // path) or the space-separated value of a preceding forwarded flag. When a
    // caller forwards unknown flags it supplies `isPositional` to tell the two
    // apart; a forwarded value is appended to `passthrough` in place so the
    // `--flag value` pair reaches tsgo in its original order and adjacency,
    // instead of being split into a separate bucket the caller later
    // concatenates out of order.
    if (opts.isPositional !== undefined && !opts.isPositional(current)) {
      passthrough.push(current);
      continue;
    }
    positional.push(current);
    if (opts.forwardAfterFirstPositional === true && positional.length === 1) {
      forwardingTail = true;
    }
  }

  if (remainder !== null) {
    // `--` separator: everything after goes to the user program when we are
    // in tail mode (ttsx after the entry), otherwise to tsgo as passthrough.
    const sink = forwardingTail ? tail : passthrough;
    for (const token of remainder) sink.push(token);
  }

  return { values, repeated, passthrough, positional, tail };
}

/**
 * Pull the value for `flag` from either `inlineValue` (`--flag=value`) or the
 * next argv token (`--flag value`), validate it per the schema, and write it to
 * the result map.
 */
function consumeFlag(
  values: Map<string, string | boolean | number>,
  repeated: Map<string, (string | boolean | number)[]>,
  flag: FlagSpec,
  token: string,
  inlineValue: string | undefined,
  rest: string[],
  errorPrefix: string,
): void {
  const record = (value: string | boolean | number): void => {
    values.set(flag.name, value);
    if (flag.repeatable !== true) return;
    const list = repeated.get(flag.name);
    if (list === undefined) repeated.set(flag.name, [value]);
    else list.push(value);
  };
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
      record(literal);
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
        record(peek);
        return;
      }
    }
    record(true);
    return;
  }

  const raw =
    inlineValue !== undefined
      ? inlineValue
      : takeValueToken(token, rest, errorPrefix);
  if (flag.validator === "positiveInt") {
    record(validatePositiveInt(token, raw, errorPrefix));
    return;
  }
  record(raw);
}

/**
 * Read the value token that follows `flag`. Throws if argv ends here OR if the
 * next token looks like another flag (`-` prefix). Without the "looks like a
 * flag" guard `ttsc --cwd --strict src/main.ts` would silently consume
 * `--strict` as the value of `--cwd`, leaving `--strict` lost and `cwd` set to
 * a junk path. Mirrors the symmetric guard already in
 * `forwardKnownButUnaccepted` (RC-1 fairness — the two value-resolution paths
 * must agree on what counts as "a missing value").
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
 * Parse a CLI boolean literal — `true`/`false` only (case-sensitive to match
 * tsgo's parser). Returns `undefined` for any other token so the caller knows
 * to throw or treat as a non-value.
 */
function parseBooleanLiteral(raw: string): boolean | undefined {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

/**
 * Validate a `positiveInt` value. Mirrors tsgo's `--checkers minValue:1`
 * constraint so a typo fails loudly at the launcher rather than reaching tsgo
 * with an invalid argument.
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
 * Forward a flag the schema knows about but the current subcommand does not
 * accept. The launcher will hand it to tsgo (or to native sidecars via
 * `--tsgo-args`); without this branch the parser would lose the value token of
 * a `--flag value` pair.
 *
 * A value option owned by tsgo always consumes its next bare token, even when
 * it ends in `.ts`; `--rootDir src.ts main.ts` has one option value and one
 * source. Schema rows belonging only to another ttsc layer still consult
 * `isPositional`, because tsgo does not own their arity.
 */
function forwardKnownButUnaccepted(
  passthrough: string[],
  flag: FlagSpec,
  original: string,
  inlineValue: string | undefined,
  rest: string[],
  isPositional: ((token: string) => boolean) | undefined,
): void {
  passthrough.push(original);
  // Boolean flags carry no required value. `--foo=value` is already one token.
  if (flag.kind === "boolean" || inlineValue !== undefined) {
    return;
  }
  if (rest.length === 0) return;
  if (rest[0]!.startsWith("-")) return;
  const tsgoOwnsArity =
    flag.consumedBy.includes("tsgo") || flag.forwardTo === "tsgo";
  if (
    tsgoOwnsArity === false &&
    isPositional !== undefined &&
    isPositional(rest[0]!)
  ) {
    return;
  }
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

/**
 * Return every string value accepted for a `repeatable` flag, in argv order.
 *
 * `values` keeps only the last occurrence, which is the wrong answer for a flag
 * whose whole point is repetition (`ttsx -r a -r b` preloads both). Returns an
 * empty array when the flag never appeared.
 */
export function getStringList(result: ParseResult, flag: string): string[] {
  return (result.repeated.get(flag) ?? []).filter(
    (value): value is string => typeof value === "string",
  );
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

import type { AnySubcommand } from "./AnySubcommand";
import type { FlagSpec } from "./FlagSpec";
import type { ParseOptions } from "./ParseOptions";
import type { ParseResult } from "./ParseResult";
import { flagsForSubcommand } from "./flagsForSubcommand";
import { normalizeFlagToken } from "./normalizeFlagToken";
import { readCompilerOptionOccurrence } from "./readCompilerOptionOccurrence";
import { resolveFlagSpec } from "./resolveFlagSpec";

/**
 * Parse `argv` according to FLAG_SCHEMA filtered by `subcommand`. Returns a
 * `ParseResult`. Throws `Error` with the configured prefix for a missing
 * launcher-owned value or a value that fails its validator. Compiler-owned and
 * unknown options retain their argv spelling for the compiler to diagnose.
 *
 * @evidence contracts/common.md#principled-implementation The cursor consumes each argv token at its grammar-owned boundary: launcher schema rows validate local values, compiler arity owns known forwarded values, and entry/separator state preserves program arguments. Canonical flag identities and ordered repetition records retain the command's permitted distinctions.
 * @evidence contracts/common.md#clear-and-simple-design One parsing loop owns the argv partition while small helpers own value reading, boolean grammar and forwarding arity; all spelling policy comes from normalizeFlagToken instead of parallel case-specific parsers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown options remain native compiler inputs rather than being guessed from particular files. The positional predicate is explicit caller policy, and response-file forwarding follows the compiler's argv contract.
 * @evidence contracts/common.md#meaningful-documentation The native comment distinguishes local errors from native diagnostics; ParseOptions and ParseResult document separator interaction and argument ownership in separate member paragraphs following the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms A monotonically advancing cursor processes N tokens without repeated array shifts; scanning and result storage are O(N) plus visited token/lookahead text and the caller's positional predicate cost. Head and separated remainder each need one invocation snapshot rather than a slice followed by another clone. Building a command's acceptance index scans fixed schema rows and their canonical/alias text once; subsequent invocations reuse it.
 * @evidence contracts/performance.md#reuse-equivalent-work Launcher acceptance indexes are shared by command identity because module-owned schema rows and normalization policy remain fixed for the loaded module; invocation argv, prefix and classifier stay local and never enter the cached computation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The module retains at most one acceptance index per finite command identity, containing references to fixed schema rows. Each cursor and result collection is invocation-owned and grows with argv size; returning transfers only the result, not the cursor or input copy.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The token-partitioning body reads metadata and argv without directly opening files, resolving paths or calling process APIs. Any native behavior in a supplied positional classifier belongs to that provider; the parser does not certify an arbitrary callback as pure.
 */
export function parseFlags(opts: ParseOptions): ParseResult {
  const accepted = launcherFlagsForSubcommand(opts.subcommand);

  const values = new Map<string, string | boolean | number>();
  const repeated = new Map<string, (string | boolean | number)[]>();
  const passthrough: string[] = [];
  const positional: string[] = [];
  const tail: string[] = [];

  // With `forwardAfterFirstPositional`, the separator is read in order rather
  // than split off first, because only the launcher's own part of argv may
  // hold it. Everything after the entry belongs to the program, which gets
  // its own `--` tokens exactly as `node` would hand them over; the one
  // separator directly after the entry is still consumed, so the documented
  // `ttsx entry.ts -- --port 3000` passes `--port 3000`.
  const separatorInOrder =
    opts.honorDoubleDashSeparator === true &&
    opts.forwardAfterFirstPositional === true;
  const separator =
    opts.honorDoubleDashSeparator === true && !separatorInOrder
      ? opts.argv.indexOf("--")
      : -1;
  let remainder: string[] | null =
    separator === -1 ? null : opts.argv.slice(separator + 1);
  const head: ArgvCursor = {
    tokens: separator === -1 ? [...opts.argv] : opts.argv.slice(0, separator),
    index: 0,
  };

  let forwardingTail = false;
  let entryJustRead = false;
  while (head.index < head.tokens.length) {
    const current = head.tokens[head.index++]!;
    const directlyAfterEntry = entryJustRead;
    entryJustRead = false;
    if (separatorInOrder && current === "--") {
      if (!forwardingTail) {
        // Before the entry, `--` ends the launcher's options as it always has.
        remainder = head.tokens.slice(head.index);
        break;
      }
      if (directlyAfterEntry) continue;
    }
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
    // `--target all` masquerade as `--all`, because the lookup is dash- and
    // case-insensitive.
    if (current.startsWith("-")) {
      const equalsIndex = current.indexOf("=");
      const token =
        equalsIndex === -1 ? current : current.slice(0, equalsIndex);
      const inlineValue =
        equalsIndex === -1 ? undefined : current.slice(equalsIndex + 1);
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
        opts.onConsumedFlag?.(
          flag.name,
          values.get(flag.name)!,
          passthrough.length,
        );
        continue;
      }

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

      // The compiler's table owns arity for options the launcher does not own.
      passthrough.push(current);
      if (
        readCompilerOptionOccurrence(head.tokens, head.index - 1).width === 2
      ) {
        passthrough.push(head.tokens[head.index++]!);
      }
      continue;
    }

    // Native ignores empty positional tokens; after the entry they remain
    // program arguments through forwardingTail above.
    if (current === "") {
      passthrough.push(current);
      continue;
    }
    if (opts.isPositional !== undefined && !opts.isPositional(current)) {
      passthrough.push(current);
      continue;
    }
    if (
      current.startsWith("@") &&
      (opts.forwardAfterFirstPositional === true ||
        opts.isPositional !== undefined)
    ) {
      passthrough.push(current);
      continue;
    }
    positional.push(current);
    if (opts.forwardAfterFirstPositional === true && positional.length === 1) {
      forwardingTail = true;
      entryJustRead = true;
    }
  }

  if (remainder !== null) {
    const sink = forwardingTail ? tail : passthrough;
    for (const token of remainder) sink.push(token);
  }

  return { values, repeated, passthrough, positional, tail };
}

/** A private token snapshot and the next token to consume. */
interface ArgvCursor {
  readonly tokens: readonly string[];
  index: number;
}

const launcherFlagsBySubcommand = new Map<
  AnySubcommand,
  ReadonlyMap<string, FlagSpec>
>();

/** Reuse the immutable schema's launcher acceptance index for one command. */
function launcherFlagsForSubcommand(
  subcommand: AnySubcommand,
): ReadonlyMap<string, FlagSpec> {
  const cached = launcherFlagsBySubcommand.get(subcommand);
  if (cached !== undefined) return cached;
  const accepted = new Map<string, FlagSpec>();
  for (const flag of flagsForSubcommand(subcommand)) {
    // A flag enters the launcher's `accepted` set only when its
    // `consumedBy` includes `"launcher"`. Flags consumed solely by tsgo
    // or by native sidecars (e.g. `--showConfig`, `--listFilesOnly`)
    // must fall through to `forwardKnownButUnaccepted` so the launcher
    // forwards them verbatim instead of storing them in `values` where
    // no consumer reads them back out. Filtering on `subcommands` alone
    // would silently drop every tsgo-only terminal flag at the launcher
    // boundary.
    if (!flag.consumedBy.includes("launcher")) continue;
    accepted.set(normalizeFlagToken(flag.name), flag);
    for (const alias of flag.aliases ?? []) {
      accepted.set(normalizeFlagToken(alias), flag);
    }
  }

  launcherFlagsBySubcommand.set(subcommand, accepted);
  return accepted;
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
  rest: ArgvCursor,
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
      // becoming `true` would be a footgun. Mirrors `validatePositiveInt`'s style.
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
    if (rest.index < rest.tokens.length) {
      const peek = parseBooleanLiteral(rest.tokens[rest.index]!);
      if (peek !== undefined) {
        rest.index++;
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
 * a junk path. This is the launcher's own missing-value policy; native scalar
 * options instead consume a following dash token through the occurrence
 * reader.
 */
function takeValueToken(
  flag: string,
  rest: ArgvCursor,
  errorPrefix: string,
): string {
  const value = rest.tokens[rest.index];
  if (value === undefined) {
    throw new Error(`${errorPrefix} ${flag} requires a value`);
  }
  if (value.startsWith("-")) {
    throw new Error(
      `${errorPrefix} ${flag} requires a value (next token ${JSON.stringify(
        value,
      )} starts with "-")`,
    );
  }
  rest.index++;
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
 *
 * The lexical rule is tsgo's too: it reads a number option with Go's
 * `strconv.Atoi`, which takes an optional sign and decimal digits only. A
 * broader JavaScript conversion would turn `1e3`, `0x10`, or `2.0`, which tsgo
 * rejects, into a different valid worker count.
 */
function validatePositiveInt(
  flag: string,
  raw: string,
  errorPrefix: string,
): number {
  const value = /^[+-]?[0-9]+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(
      `${errorPrefix} ${flag} expects a positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

/**
 * Forward a flag the schema knows about but the current subcommand does not
 * accept. The launcher will hand it to tsgo (or to native sidecars through the
 * `TTSC_TSGO_ARGS` environment payload); without this branch it would lose the
 * value token of a `--flag value` pair.
 *
 * Native metadata owns whether a following token is consumed. Scalar operands
 * can include dash prefixes or `.ts` suffixes; `--rootDir src.ts main.ts` has
 * one option value and one source. List and configuration-only operands retain
 * their distinct native widths. Schema rows belonging only to another ttsc
 * layer still consult `isPositional`, because tsgo does not own their arity.
 */
function forwardKnownButUnaccepted(
  passthrough: string[],
  flag: FlagSpec,
  original: string,
  inlineValue: string | undefined,
  rest: ArgvCursor,
  isPositional: ((token: string) => boolean) | undefined,
): void {
  passthrough.push(original);
  const native = readCompilerOptionOccurrence(rest.tokens, rest.index - 1);
  if (native.option !== undefined) {
    if (native.width === 2) passthrough.push(rest.tokens[rest.index++]!);
    return;
  }
  // Boolean flags carry no required value. `--foo=value` is already one token.
  if (flag.kind === "boolean" || inlineValue !== undefined) {
    return;
  }
  if (rest.index === rest.tokens.length) return;
  if (rest.tokens[rest.index]!.startsWith("-")) return;
  const tsgoOwnsArity =
    flag.consumedBy.includes("tsgo") || flag.forwardTo === "tsgo";
  if (
    tsgoOwnsArity === false &&
    isPositional !== undefined &&
    isPositional(rest.tokens[rest.index]!)
  ) {
    return;
  }
  passthrough.push(rest.tokens[rest.index++]!);
}

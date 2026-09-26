import type { FlagSpec } from "../../../flags/FlagSpec";
import { resolveFlagSpec } from "../../../flags/resolveFlagSpec";
import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";

/**
 * Questions about the compiler flags a user forwarded through ttsc.
 *
 * Ttsc forwards every flag it does not own to TypeScript-Go verbatim, then has
 * to answer a few questions about them itself: whether timing was asked for,
 * whether a flag turns the build into a terminal command, whether a flag is one
 * ttsc consumes internally. Every answer resolves the token through the flag
 * schema, so a question is decided by the flag's identity (any case, one or two
 * dashes) and, for a boolean flag, by the value TypeScript-Go gives it.
 */
export namespace PassthroughFlags {
  /**
   * Whether `--diagnostics` or `--extendedDiagnostics` is in effect after every
   * forwarded occurrence, read the way TypeScript-Go reads them.
   */
  export function hasDiagnosticsFlag(options: TtscCommonOptions): boolean {
    const enabled = effectiveBooleanFlags(options);
    return enabled.some(
      (flag) =>
        flag.name === "--diagnostics" || flag.name === "--extendedDiagnostics",
    );
  }

  /**
   * Report whether the caller forwarded a print-and-exit tsgo flag
   * (`--showConfig`, `--listFilesOnly`, `--all`, `--init`, `-?`) that is in
   * effect, so ttsc can avoid adding compile-only flags to a command that is
   * not going to compile.
   *
   * Schema-derived, and resolved by flag identity rather than by exact
   * spelling: adding a new terminal flag means editing `FLAG_SCHEMA.ts` and
   * re-running `pnpm run gen:flags`; this predicate needs no edit. A terminal
   * flag the user turned off (`--showConfig false`) is an ordinary compile to
   * TypeScript-Go, so it must not lift the emit guards of one.
   */
  export function forwardsTerminalTsgoFlag(
    options: TtscCommonOptions,
  ): boolean {
    return effectiveBooleanFlags(options).some(
      (flag) => flag.terminal === true,
    );
  }

  /**
   * Report whether the caller forwarded a terminal flag, in effect, whose
   * meaning does not presuppose a resolved project (`--init`, `--all`, `-?`).
   *
   * Derived from `FLAG_SCHEMA[*].projectFree`, through the same identity
   * resolution as every other classification — never a literal list of flag
   * names beside this branch, which is the shape that let terminal-flag
   * awareness exist in one layer and be missing from the layer above it.
   */
  export function forwardsProjectFreeTerminalTsgoFlag(
    options: TtscCommonOptions,
  ): boolean {
    return effectiveBooleanFlags(options).some(
      (flag) => flag.terminal === true && flag.projectFree === true,
    );
  }

  /**
   * Report whether the caller forwarded a flag ttsc adds to tsgo internally —
   * e.g. `--listEmittedFiles` (ttsc adds it to learn emitted paths) or
   * `--noEmit` (ttsc adds it for the pre-emit type-check). When the user also
   * forwards the same flag, post-processing must keep the user-visible effect
   * intact instead of stripping it as ttsc-internal noise.
   *
   * Schema-derived: `FLAG_SCHEMA[*].internalShadow === true`. RC-2 from the RCA
   * (RCA section 3, `--listEmittedFiles` / `--showConfig` swallowed): the
   * per-flag `passthrough.includes("…")` check is now one structural lookup
   * against the schema, not one bespoke `if` per shadow flag.
   */
  export function forwardsInternalShadowFlag(
    options: TtscCommonOptions,
    flag: string,
  ): boolean {
    const passthrough = options.passthrough;
    if (passthrough === undefined) return false;
    // Resolution covers the bare form (`--pretty`), the inline-value form
    // (`--pretty=true`), and every casing tsgo accepts (`--PRETTY`) — the
    // launcher forwards the user's own spelling verbatim, so comparing raw
    // strings would miss a spelling tsgo honours.
    return passthrough.some((token) => {
      const spec = resolveFlagSpec(token);
      return spec?.internalShadow === true && spec.name === flag;
    });
  }

  /**
   * The forwarded argv without the occurrences of the named boolean flags, each
   * removed together with the value token TypeScript-Go would consume for it.
   *
   * Only an occurrence TypeScript-Go itself accepts is removed. A spelling it
   * rejects (`--diagnostics=false`) or a value it does not consume
   * (`--diagnostics TRUE`, whose `TRUE` is an input file to it) stays, so the
   * compiler that receives the rest still reports the malformed argv instead of
   * ttsc erasing it into a successful build.
   */
  export function withoutBooleanFlags(
    passthrough: readonly string[],
    names: readonly string[],
  ): string[] {
    const out: string[] = [];
    for (let i = 0; i < passthrough.length; i++) {
      const occurrence = booleanOccurrence(passthrough, i);
      if (occurrence !== undefined && names.includes(occurrence.flag.name)) {
        i += occurrence.width - 1;
        continue;
      }
      out.push(passthrough[i]!);
    }
    return out;
  }

  /**
   * Every schema boolean flag whose last forwarded occurrence turns it on.
   * TypeScript-Go assigns an option at each occurrence, so the last one wins.
   */
  function effectiveBooleanFlags(options: TtscCommonOptions): FlagSpec[] {
    const passthrough = options.passthrough ?? [];
    const values = new Map<FlagSpec, boolean>();
    for (let i = 0; i < passthrough.length; i++) {
      const occurrence = booleanOccurrence(passthrough, i);
      if (occurrence === undefined) continue;
      values.set(occurrence.flag, occurrence.value);
      i += occurrence.width - 1;
    }
    return [...values].filter(([, value]) => value).map(([flag]) => flag);
  }

  /**
   * Read one argv position the way TypeScript-Go's command-line parser reads a
   * boolean option.
   *
   * The name matches case-insensitively after one or two dashes, and an inline
   * `=` is not split, so `--flag=false` names no option at all. A following
   * token is consumed only when it is exactly `true`, `false`, or `null`; only
   * `false` and `null` turn the option off. Any other following token stays an
   * argument of its own, and the option is on.
   */
  function booleanOccurrence(
    argv: readonly string[],
    index: number,
  ):
    | {
        readonly flag: FlagSpec;
        readonly value: boolean;
        readonly width: 1 | 2;
      }
    | undefined {
    const token = argv[index]!;
    if (token.includes("=")) return undefined;
    const flag = resolveFlagSpec(token);
    if (flag === undefined || flag.kind !== "boolean") return undefined;
    const next = argv[index + 1];
    if (next === "true") return { flag, value: true, width: 2 };
    if (next === "false" || next === "null")
      return { flag, value: false, width: 2 };
    return { flag, value: true, width: 1 };
  }
}

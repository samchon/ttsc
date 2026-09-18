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
 * dashes, inline `=value`) exactly as the compiler would decide it.
 */
export namespace PassthroughFlags {
  /**
   * Whether `--diagnostics` or `--extendedDiagnostics` was forwarded and not
   * disabled by an explicit `false` value.
   */
  export function hasDiagnosticsFlag(options: TtscCommonOptions): boolean {
    return (
      hasEnabledPassthroughFlag(options, "--diagnostics") ||
      hasEnabledPassthroughFlag(options, "--extendedDiagnostics")
    );
  }

  function hasEnabledPassthroughFlag(
    options: TtscCommonOptions,
    flag: string,
  ): boolean {
    const passthrough = options.passthrough ?? [];
    for (let i = 0; i < passthrough.length; i++) {
      const token = passthrough[i]!;
      // Identity, not spelling: the user forwards their own casing and ttsc must
      // read `--DIAGNOSTICS` the way tsgo does.
      if (resolveFlagSpec(token)?.name !== flag) continue;
      const equalsIndex = token.indexOf("=");
      if (equalsIndex !== -1) {
        return token.slice(equalsIndex + 1).toLowerCase() !== "false";
      }
      if (i + 1 < passthrough.length && isBooleanLiteral(passthrough[i + 1]!)) {
        return passthrough[i + 1]!.toLowerCase() !== "false";
      }
      return true;
    }
    return false;
  }

  /**
   * Report whether the caller forwarded a print-and-exit tsgo flag
   * (`--showConfig`, `--listFilesOnly`, `--all`, `--init`, `-?`), so ttsc can
   * avoid adding compile-only flags to a command that is not going to compile.
   *
   * Schema-derived, and resolved by flag identity rather than by exact spelling:
   * `resolveFlagSpec` applies the one normalization the parsing engine and the
   * generated Go allow-lists use, so `--showconfig` classifies exactly like
   * `--showConfig`. Adding a new terminal flag means editing `FLAG_SCHEMA.ts` and
   * re-running `pnpm run gen:flags`; this predicate needs no edit, and it grows
   * no normalization of its own for the next consumer to forget.
   */
  export function forwardsTerminalTsgoFlag(
    options: TtscCommonOptions,
  ): boolean {
    return (
      options.passthrough?.some(
        (token) => resolveFlagSpec(token)?.terminal === true,
      ) ?? false
    );
  }

  /**
   * Report whether the caller forwarded a terminal flag whose meaning does not
   * presuppose a resolved project (`--init`, `--all`, `-?`).
   *
   * Derived from `FLAG_SCHEMA[*].projectFree`, through the same identity
   * resolution as every other classification — never a literal list of flag names
   * beside this branch, which is the shape that let terminal-flag awareness exist
   * in one layer and be missing from the layer above it.
   */
  export function forwardsProjectFreeTerminalTsgoFlag(
    options: TtscCommonOptions,
  ): boolean {
    return (
      options.passthrough?.some((token) => {
        const flag = resolveFlagSpec(token);
        return flag?.terminal === true && flag.projectFree === true;
      }) ?? false
    );
  }

  /**
   * Report whether the caller forwarded a flag ttsc adds to tsgo internally —
   * e.g. `--listEmittedFiles` (ttsc adds it to learn emitted paths) or `--noEmit`
   * (ttsc adds it for the pre-emit type-check). When the user also forwards the
   * same flag, post-processing must keep the user-visible effect intact instead
   * of stripping it as ttsc-internal noise.
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
   * Whether one argv token names `--diagnostics` or `--extendedDiagnostics`, in
   * any spelling the compiler accepts. Used to strip those flags from a native
   * host's argv, which reports timing through its own channel.
   */
  export function isDiagnosticsPassthroughFlag(token: string): boolean {
    const name = resolveFlagSpec(token)?.name;
    return name === "--diagnostics" || name === "--extendedDiagnostics";
  }

  /**
   * Whether a token is the explicit value of a boolean flag (`true` or `false`,
   * any case), so the pair `--flag false` is consumed together.
   */
  export function isBooleanLiteral(token: string): boolean {
    const normalized = token.toLowerCase();
    return normalized === "true" || normalized === "false";
  }
}

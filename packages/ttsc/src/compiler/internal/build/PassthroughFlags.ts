import type { FlagSpec } from "../../../flags/FlagSpec";
import { readCompilerOptionOccurrence } from "../../../flags/readCompilerOptionOccurrence";
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
 *
 * Classification observes this unexpanded argv frame. It does not read response
 * files; their contents and effects remain owned by the native compiler and
 * cannot be certified by these predicates.
 *
 * @evidence contracts/common.md#principled-implementation Schema identities and compiler-compatible boolean occurrence parsing distinguish effective flags from mere user-owned presence.
 * @evidence contracts/common.md#clear-and-simple-design The grouping centralizes forwarding classification and preservation policy so higher build layers do not maintain parallel literal flag sets.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Shared schema metadata replaces producer-name or exact-spelling exceptions, and malformed argv remains under compiler diagnostic ownership.
 * @evidence contracts/common.md#meaningful-documentation Namespace prose explains why forwarding also needs classification; public comments document precedence, preservation and distinct presence semantics.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups APIs; selected predicates and argv transformation functions own their scans and allocations.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No completed or in-flight computation is retained by this API grouping.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no persistent map, task or handle; helper parser state is invocation-local.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A namespace only groups the declarations inside it; each carries its own acknowledgments.
 */
export namespace PassthroughFlags {
  /**
   * Whether a visible `--diagnostics` or `--extendedDiagnostics` occurrence
   * remains enabled in this unexpanded argv frame, using native boolean rules.
   *
   * @evidence contracts/common.md#principled-implementation Last-occurrence boolean interpretation matches compiler option assignment, so a later false or null disables earlier diagnostics selection.
   * @evidence contracts/common.md#clear-and-simple-design Shared boolean parsing resolves schema identities; this predicate asks only whether either timing flag remains enabled.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual forwarded tokens and schema determine timing rather than exact-spelling checks or benchmark-only flag handling.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies effective rather than merely present flags and compiler-compatible precedence.
   * @evidence contracts/performance.md#efficient-algorithms One native-occurrence cursor records final values per schema flag, then scans enabled schema references. Work includes argv count, token-name normalization and list-lookahead text bytes; local maps/arrays are bounded by distinct schema flags and transient parsing by the current value's bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate inspects current mutable options and coordinates no retained or in-flight computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Boolean state is local to the call; no argument history or resource is retained.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation hasDiagnosticsFlag computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
   */
  export function hasDiagnosticsFlag(options: TtscCommonOptions): boolean {
    const enabled = effectiveBooleanFlags(options);
    return enabled.some(
      (flag) =>
        flag.name === "--diagnostics" || flag.name === "--extendedDiagnostics",
    );
  }

  /**
   * Report whether this unexpanded argv frame includes an enabled
   * print-and-exit tsgo flag (`--showConfig`, `--listFilesOnly`, `--all`,
   * `--init`, `-?`) that is in effect, so ttsc can avoid adding compile-only
   * flags to a command that is not going to compile.
   *
   * Schema-derived, and resolved by flag identity rather than by exact
   * spelling: adding a new terminal flag means editing `FLAG_SCHEMA.ts` and
   * re-running `pnpm run gen:flags`; this predicate needs no edit. A terminal
   * flag the user turned off (`--showConfig false`) is an ordinary compile to
   * TypeScript-Go, so it must not lift the emit guards of one.
   *
   * @evidence contracts/common.md#principled-implementation Only enabled boolean flags carrying schema terminal semantics classify a print-and-exit request; disabled occurrences cannot lift compilation guards.
   * @evidence contracts/common.md#clear-and-simple-design Schema metadata owns terminal classification and the shared parser owns value precedence, avoiding parallel flag lists in build orchestration.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This uses supported flag metadata rather than selected spelling exceptions or treating malformed argv as a successful terminal request.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain terminal effects, schema ownership and the significance of a disabled occurrence.
   * @evidence contracts/performance.md#efficient-algorithms A native-occurrence cursor interprets argv once, including token-name and list-lookahead bytes, then short-circuits on an enabled terminal schema flag. Local final-value references are bounded by distinct schema flags; transient parsing scales with the current lookahead value.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Classification reads one options value and establishes no reusable producer or cross-request state.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only invocation-local parser state is allocated; no process or retained history is owned.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Terminal metadata and native-compatible boolean assignments classify compiler argv only; no native path is resolved or process/OS capability acquired here.
   */
  export function forwardsTerminalTsgoFlag(
    options: TtscCommonOptions,
  ): boolean {
    return effectiveBooleanFlags(options).some(
      (flag) => flag.terminal === true,
    );
  }

  /**
   * Report whether an enabled terminal flag visible in this unexpanded frame
   * has project-independent meaning (`--init`, `--all`, `-?`).
   *
   * Derived from `FLAG_SCHEMA[*].projectFree`, through the same identity
   * resolution as every other classification — never a literal list of flag
   * names beside this branch. Project dependence stays owned by the schema.
   *
   * @evidence contracts/common.md#principled-implementation Project-free classification requires both enabled terminal behavior and schema projectFree metadata, distinguishing config-independent commands from show-config requests.
   * @evidence contracts/common.md#clear-and-simple-design The same final boolean interpretation serves all classifications while schema metadata owns which commands require a project.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Project bypass is granted by declared flag semantics, not by catching arbitrary setup failures and pretending compilation succeeded.
   * @evidence contracts/common.md#meaningful-documentation The preceding native prose explains the project-independent meaning and schema source; acknowledgments are kept apart from descriptive paragraphs.
   * @evidence contracts/performance.md#efficient-algorithms The shared occurrence cursor scans token names and list-lookahead text before a short-circuit scan of distinct enabled schema references. Parsing and local value/reference arrays remain invocation-bound; no project read or response-file expansion is added.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This classification does not coordinate repeated production or retain option interpretation between requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources All parser state is local and no native resource is acquired.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation A schema projectFree boolean classifies option meaning without resolving configs, reading paths or probing executables; those native capabilities belong to the execution owner.
   */
  export function forwardsProjectFreeTerminalTsgoFlag(
    options: TtscCommonOptions,
  ): boolean {
    return effectiveBooleanFlags(options).some(
      (flag) => flag.terminal === true && flag.projectFree === true,
    );
  }

  /**
   * Report whether this unexpanded frame visibly names a flag ttsc adds
   * internally — e.g. `--listEmittedFiles` (ttsc adds it to learn emitted
   * paths) or `--noEmit` (ttsc adds it for the pre-emit type-check). When the
   * user also forwards the same flag, post-processing must keep the
   * user-visible effect intact instead of stripping it as ttsc-internal noise.
   *
   * Schema-derived: `FLAG_SCHEMA[*].internalShadow === true`.
   *
   * Presence identifies a user-owned option spelling, including malformed
   * inline-value spelling that must remain available for the compiler to
   * reject. This predicate does not decide whether the boolean occurrence is
   * enabled.
   *
   * @evidence contracts/common.md#principled-implementation Schema identity plus internalShadow metadata distinguishes user-owned output/option selection from flags introduced only for internal collection.
   * @evidence contracts/common.md#clear-and-simple-design Presence recognition is separate from effective boolean parsing because preservation and execution classification have different requirements.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Recognizing malformed user spelling prevents internally supplied values from erasing its compiler error; no producer method or argv is patched.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes presence from enabled state and explains why malformed inline spelling is still recognized.
   * @evidence contracts/performance.md#efficient-algorithms A short-circuit native-occurrence cursor resolves visible flag names and skips consumed operands; work includes visited token-name and list-lookahead bytes. Only transient current-value parsing is allocated, with no final flag table or argv copy.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current argv presence is inspected directly without coordinating a shared or retained producer.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This lookup owns no persistent state or handle.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Canonical shadow identity and argv consumption are compiler-token policy; no token is resolved as a native filesystem path and no process or OS capability is accessed.
   */
  export function forwardsInternalShadowFlag(
    options: TtscCommonOptions,
    flag: string,
  ): boolean {
    const passthrough = options.passthrough;
    if (passthrough === undefined) return false;
    // Resolution covers the bare form (`--pretty`), the inline-value form
    // (`--pretty=true`), and case variants (`--PRETTY`). This is identity
    // recognition, not acceptance of an inline boolean value by tsgo.
    for (let index = 0; index < passthrough.length; ) {
      const spec = resolveFlagSpec(passthrough[index]!);
      if (spec?.internalShadow === true && spec.name === flag) return true;
      index += readCompilerOptionOccurrence(passthrough, index).width;
    }
    return false;
  }

  /**
   * This unexpanded argv frame without visible occurrences of the named boolean
   * flags, each removed with the value token TypeScript-Go would consume for
   * it.
   *
   * Only an occurrence TypeScript-Go itself accepts is removed. An inline
   * spelling it rejects (`--diagnostics=false`) stays for native diagnosis.
   * Unconsumed data also stays: `--diagnostics TRUE` removes the enabled option
   * but leaves `TRUE` as a native input file. Its acceptance or failure belongs
   * to the compiler, rather than being certified as a malformed boolean here.
   *
   * An empty token preserves an unconsumed lookahead boundary when deletion
   * would otherwise bind later data to a retained boolean, list or config-only
   * option. A surviving dash option already preserves that boundary; adjacent
   * removals defer the fence until they expose data or the end of the frame.
   * Native parsing ignores the empty token as a positional input.
   *
   * @evidence contracts/common.md#principled-implementation The native cursor identifies valid boolean assignments and skips scalar operands. Removal retains malformed spelling and inserts a native-ignored empty lookahead fence when needed to preserve the remaining options, files and diagnostics.
   * @evidence contracts/common.md#clear-and-simple-design One indexed argv walk uses the shared occurrence parser and builds a fresh output array without modifying caller tokens.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid argv is preserved for the compiler's real diagnostic instead of being normalized into a successful request.
   * @evidence contracts/common.md#meaningful-documentation Native examples explain inline rejection and unconsumed uppercase values, giving the reason preservation matters.
   * @evidence contracts/performance.md#efficient-algorithms The cursor visits A argv tokens with linear membership checks over D supplied removal names, giving O(A times D) membership work plus visited token/lookahead text bytes. Production consumers supply one or two names; consumed operands are skipped. Returned references grow with A, and transient list parsing with the current value's bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This transforms one argv sequence without retaining or coordinating equivalent computation across requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The new array is transferred to the caller and no token history or handle remains owned here.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Removing compiler-token occurrences and inserting native-ignored empty fences interprets no filesystem path and accesses no process, shell or OS capability; the downstream compiler owns response-file expansion and execution.
   */
  export function withoutBooleanFlags(
    passthrough: readonly string[],
    names: readonly string[],
  ): string[] {
    const out: string[] = [];
    let previousNeedsFence = false;
    for (let i = 0; i < passthrough.length; ) {
      const occurrence = readCompilerOptionOccurrence(passthrough, i);
      const flag = resolveFlagSpec(passthrough[i]!);
      if (
        occurrence.booleanValue !== undefined &&
        flag !== undefined &&
        names.includes(flag.name)
      ) {
        // Native ignores an empty positional token. It also prevents a
        // retained boolean/list/config-only option from consuming newly
        // adjacent data after the removed option disappears.
        const next = passthrough[i + occurrence.width];
        if (
          previousNeedsFence &&
          (next === undefined || !next.startsWith("-"))
        ) {
          out.push("");
          previousNeedsFence = false;
        }
        i += occurrence.width;
        continue;
      }
      out.push(...passthrough.slice(i, i + occurrence.width));
      previousNeedsFence = occurrence.needsFence;
      i += occurrence.width;
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
    for (let i = 0; i < passthrough.length; ) {
      const occurrence = readCompilerOptionOccurrence(passthrough, i);
      if (occurrence.booleanValue !== undefined) {
        const flag = resolveFlagSpec(passthrough[i]!);
        if (flag !== undefined) values.set(flag, occurrence.booleanValue);
      }
      i += occurrence.width;
    }
    return [...values].filter(([, value]) => value).map(([flag]) => flag);
  }
}

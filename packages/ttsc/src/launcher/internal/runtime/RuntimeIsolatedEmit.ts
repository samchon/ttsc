/**
 * Compiler arguments shared by orphan execution and export-name preparation.
 *
 * These isolated emits ignore consumer configuration and use ES2022 lowering.
 * The runtime chooses the source's module format before calling this policy;
 * export-name preparation requests CommonJS. Execution includes source maps,
 * while speculative name preparation keeps its output separate from the
 * runtime orphan cache. Compiler invocation and fallback belong to the caller.
 *
 * @evidence contracts/common.md#principled-implementation Both callers use the same isolated compiler policy and the cache includes that policy's original token sequence, preserving lowering and cache identity together.
 * @evidence contracts/common.md#clear-and-simple-design One internal namespace owns argument construction and its cache discriminator; invocation, source ownership and fallback remain in the runtime hook owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported compiler flags express isolation and lowering without rewriting source text, replacing a compiler or adding a test-only execution path.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish execution maps, CommonJS name preparation and the caller's remaining compiler/fallback responsibilities.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This namespace groups argument-data operations; the caller owns native executable, cwd, file and process boundaries.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The container performs no computation; its members describe argument and discriminator construction.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace coordinates no cached or in-flight emit; the caller uses its discriminator in the actual cache policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Immutable policy tokens retain fixed data and no handles, tasks or request history.
 */
export namespace RuntimeIsolatedEmit {
  /**
   * Build the isolated emit arguments for an already selected source and format.
   *
   * Module execution uses ESNext emit; CommonJS execution and name preparation
   * use CommonJS emit. Only execution requests external maps and inline source
   * content. Paths remain separate argument values, including spaces.
   *
   * @evidence contracts/common.md#principled-implementation The selected format supplies the native module flag, fixed isolation flags suppress config and type-checking, and the purpose controls only the existing map suffix.
   * @evidence contracts/common.md#clear-and-simple-design A fresh ordered token array combines selected input/output values with one common policy and the execution-only map pair.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Arguments are ordinary compiler options, not shell text, synthetic compiler outputs or source-value substitutions.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph identifies format mapping, map ownership and path-token preservation without claiming actual lowering ran.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation copies opaque path values into argv and accesses no native path, file or process; the invocation owner supplies their supported context.
   * @evidence contracts/performance.md#efficient-algorithms A fixed policy and fixed optional suffix create a constant number of token references; input and output strings are retained as values without scanning their text or compiling source.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Argument construction coordinates no completed or in-flight compilation; emit reuse belongs to the caller's content and compiler identity policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned array transfers to the caller and no historical input, handle or task remains in this operation.
   */
  export function compilerArgs(
    input: string,
    outDir: string,
    format: "commonjs" | "module",
    purpose: "execution" | "export-scan",
  ): string[] {
    return [
      input,
      "--module",
      format === "commonjs" ? "commonjs" : "esnext",
      ...ISOLATED_EMIT_ARGS,
      ...(purpose === "execution" ? ["--sourceMap", "--inlineSources"] : []),
      "--outDir",
      outDir,
    ];
  }

  /**
   * The original NUL-separated isolated policy tokens included in orphan keys.
   * Module format and the source-map version remain separate caller-owned key
   * inputs. This string does not prove compiler or source identity.
   *
   * @evidence contracts/common.md#principled-implementation Joining the same base tokens used by argument construction preserves the existing cache discriminator byte order and separators.
   * @evidence contracts/common.md#clear-and-simple-design The policy discriminator comes from its single token owner rather than a duplicated list in the runtime cache.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The discriminator describes actual flags; it does not substitute for the caller's compiler/content observations or certify a cache hit.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph distinguishes base policy from module/map and actual identity inputs in the cache key.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Joining fixed option strings has no native platform boundary.
   * @evidence contracts/performance.md#efficient-algorithms Joining the fixed policy visits its total token text and allocates one result string; there are no input-dependent source or file scans.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation supplies a discriminator and coordinates no reusable emit; cache admission remains with its caller.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned string belongs to the caller; no historical values, handles or tasks are retained.
   */
  export function policyKey(): string {
    return ISOLATED_EMIT_ARGS.join("\0");
  }
}

/**
 * Config-free lowering leaves type diagnostics with the checked entry owner.
 * Isolation avoids imported const-enum inlining and secondary emits. Unowned
 * TSX uses the automatic JSX runtime, respecting any source import pragma.
 */
const ISOLATED_EMIT_ARGS = [
  "--ignoreConfig",
  "--target",
  "es2022",
  "--jsx",
  "react-jsx",
  "--noCheck",
  "--skipLibCheck",
  "--noResolve",
  "--isolatedModules",
] as const;

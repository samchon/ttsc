import { resolveCompilerEnvironment } from "ttsc";

/**
 * Native argument vectors and publisher environments for graph processes.
 *
 * @evidence contracts/common.md#principled-implementation Separate argv elements preserve project and artifact coordinates exactly, while lint's existing equals-form flags carry its manifest and context.
 * @evidence contracts/common.md#clear-and-simple-design Resident vectors and publisher environments share one permission validator with one-shot launchers; the SDK owns environment capture.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native options are explicit argv fields rather than shell strings, coercions or fixture-specific arguments.
 * @evidence contracts/common.md#meaningful-documentation Each builder states its protocol and the absence meaning of optional artifact/context coordinates.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups launch contracts; individual builders own native coordinate and environment representation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources returns plain launch data and holds no handle.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace only groups builders; each member documents its actual work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work its builders recompute a small array per spawn, so nothing is shared.
 */
export namespace TtscGraphNativeArguments {
  /**
   * Capture the compiler permission and inherited argument context for a
   * publisher.
   *
   * @evidence contracts/common.md#principled-implementation The SDK's shared capture preserves inherited argv/cwd and appends an explicit permission assignment without changing process.env.
   * @evidence contracts/common.md#clear-and-simple-design One environment builder serves synchronous publishers, resident daemons and asynchronous direct fallbacks.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The existing compiler argument transport reaches real sidecars without inventing a new native flag or replacing compiler parsing.
   * @evidence contracts/common.md#meaningful-documentation Native prose states compiler-context capture and its publisher consumers.
   * @evidence contracts/portability.md#os-neutral-implementation The SDK applies native Windows channel aliases and preserves JSON argv and cwd without shell syntax.
   * @evidence contracts/performance.md#efficient-algorithms Delegated capture copies environment keys and parses/serializes argument bytes only for an explicit permission.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The publication owner captures once and shares this value across both verbs and their daemon or fallback; this builder adds no cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The detached value transfers to the process owner and retains no handle or history.
   */
  export function environment(
    runExternalCode?: boolean,
    inherited: NodeJS.ProcessEnv = process.env,
  ): NodeJS.ProcessEnv {
    permission(runExternalCode);
    return resolveCompilerEnvironment(runExternalCode, inherited);
  }

  /**
   * Graph serve argv; absent artifacts or permission add no corresponding flag.
   *
   * @evidence contracts/common.md#principled-implementation Separate argv fields preserve graph cwd/config and the optional artifact path without shell parsing.
   * @evidence contracts/common.md#clear-and-simple-design This builder is the actual facade's single launch-vector owner for serve.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing supported flags are mapped directly; there is no shell command or fixture branch.
   * @evidence contracts/common.md#meaningful-documentation The native headline states the protocol and the optional coordinate's absence meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Node spawn consumes the returned argv vector with native coordinate strings intact; no slash rewriting or shell quoting interprets paths, manifests or contexts.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources returns a fresh value and keeps no handle or state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms concatenates a fixed argv with at most one optional pair, in constant work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work builds one argv per spawn.
   */
  export function serve(
    cwd: string,
    tsconfig: string,
    artifacts: string | null,
    runExternalCode?: boolean,
  ): string[] {
    return [
      "serve",
      "--cwd",
      cwd,
      "--tsconfig",
      tsconfig,
      ...(artifacts === null ? [] : ["--artifacts", artifacts]),
      ...permission(runExternalCode),
    ];
  }

  /**
   * Preserve omission or encode an explicit upstream permission assignment.
   *
   * @evidence contracts/common.md#principled-implementation A boolean assignment preserves true and false, while omission leaves inherited compiler arguments unchanged.
   * @evidence contracts/common.md#clear-and-simple-design One validator supplies dump, viewer and resident argument construction.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nonboolean JavaScript input throws before a native invocation rather than granting permission through coercion.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies optional-state and assignment semantics.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The returned argv token contains no native path or shell syntax.
   * @evidenceExclude contracts/performance.md#efficient-algorithms One scalar validation produces at most one token.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation constructs its own permission token.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned array transfers to the caller without retaining state.
   */
  export function permission(value?: boolean): string[] {
    if (value === undefined) return [];
    if (typeof value !== "boolean")
      throw new TypeError("@ttsc/graph: runExternalCode must be a boolean");
    return [`--runExternalCode=${String(value)}`];
  }

  /**
   * Lint daemon argv; absent context retains the context-free rule contract.
   *
   * @evidence contracts/common.md#principled-implementation Equals-form argv fields retain the sidecar manifest and optional context as one native argument each.
   * @evidence contracts/common.md#clear-and-simple-design This builder is the actual facade's single launch-vector owner for lint.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing supported flags are mapped directly; there is no shell command or fixture branch.
   * @evidence contracts/common.md#meaningful-documentation The native headline states the protocol and the optional coordinate's absence meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Node spawn consumes the returned argv vector with native coordinate strings intact; no slash rewriting or shell quoting interprets paths, manifests or contexts.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources returns a fresh value and keeps no handle or state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms concatenates a fixed argv with at most one optional entry, in constant work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work builds one argv per spawn.
   */
  export function lint(
    cwd: string,
    tsconfig: string,
    manifest: string,
    context?: string,
  ): string[] {
    return [
      "lsp-serve",
      `--cwd=${cwd}`,
      `--tsconfig=${tsconfig}`,
      `--plugins-json=${manifest}`,
      ...(context === undefined ? [] : [`--project-context-json=${context}`]),
    ];
  }
}

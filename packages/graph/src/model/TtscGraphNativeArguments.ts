/**
 * Native argument vectors for graph and lint resident processes.
 *
 * @evidence contracts/common.md#principled-implementation Separate argv elements preserve project and artifact coordinates exactly, while lint's existing equals-form flags carry its manifest and context.
 * @evidence contracts/common.md#clear-and-simple-design Two builders centralize the actual resident launch contracts used by their respective facades.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported native flags are retained without new CLI options, shell strings or fixture-specific arguments.
 * @evidence contracts/common.md#meaningful-documentation Each builder states its protocol and the absence meaning of optional artifact/context coordinates.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups argv builders; serve and lint own their native coordinate representation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscGraphNativeArguments declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscGraphNativeArguments declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscGraphNativeArguments declares a data shape or groups members and coordinates no computation across requests.
 */
export namespace TtscGraphNativeArguments {
  /**
   * Graph serve argv; a null artifact answer adds no startup overlay flag.
   *
   * @evidence contracts/common.md#principled-implementation Separate argv fields preserve graph cwd/config and the optional artifact path without shell parsing.
   * @evidence contracts/common.md#clear-and-simple-design This builder is the actual facade's single launch-vector owner for serve.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing supported flags are mapped directly; there is no shell command or fixture branch.
   * @evidence contracts/common.md#meaningful-documentation The native headline states the protocol and the optional coordinate's absence meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Node spawn consumes the returned argv vector with native coordinate strings intact; no slash rewriting or shell quoting interprets paths, manifests or contexts.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscGraphNativeArguments.serve acquires no handle or task and retains nothing beyond its return value.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TtscGraphNativeArguments.serve makes a bounded pass over its arguments and chooses no algorithm or data structure.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscGraphNativeArguments.serve computes its value from its arguments on each call and shares no completed or in-flight work.
   */
  export function serve(cwd: string, tsconfig: string, artifacts: string | null): string[] {
    return ["serve", "--cwd", cwd, "--tsconfig", tsconfig, ...(artifacts === null ? [] : ["--artifacts", artifacts])];
  }

  /**
   * Lint daemon argv; absent context retains the context-free rule contract.
   *
   * @evidence contracts/common.md#principled-implementation Equals-form argv fields retain the sidecar manifest and optional context as one native argument each.
   * @evidence contracts/common.md#clear-and-simple-design This builder is the actual facade's single launch-vector owner for lint.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing supported flags are mapped directly; there is no shell command or fixture branch.
   * @evidence contracts/common.md#meaningful-documentation The native headline states the protocol and the optional coordinate's absence meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Node spawn consumes the returned argv vector with native coordinate strings intact; no slash rewriting or shell quoting interprets paths, manifests or contexts.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscGraphNativeArguments.lint acquires no handle or task and retains nothing beyond its return value.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TtscGraphNativeArguments.lint makes a bounded pass over its arguments and chooses no algorithm or data structure.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscGraphNativeArguments.lint computes its value from its arguments on each call and shares no completed or in-flight work.
   */
  export function lint(cwd: string, tsconfig: string, manifest: string, context?: string): string[] {
    return ["lsp-serve", `--cwd=${cwd}`, `--tsconfig=${tsconfig}`, `--plugins-json=${manifest}`, ...(context === undefined ? [] : [`--project-context-json=${context}`])];
  }
}

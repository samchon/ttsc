import type { RuntimeManifest } from "./RuntimeManifest";

/**
 * Select the plugin policy shared by runtime project and isolated-root builds.
 * Descriptor evaluation disables plugins to prevent recursive self-hosting. A
 * run that disabled them retains that policy for every subsequently loaded
 * project, independent of which manifest supplied its runtime cache.
 *
 * @evidence contracts/common.md#principled-implementation Descriptor evaluation or any manifest with plugins false selects disabled loading; otherwise the owning project's ordinary discovery remains available.
 * @evidence contracts/common.md#clear-and-simple-design One pure selection owns the same policy for project builds, isolated roots and their cache identity; runtime observation stays with the hook owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit run and evaluator policy determine selection without recognizing plugin names, replacing module methods or manufacturing successful builds.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain evaluator recursion and the inherited run policy across project boundaries, with inputs documented beside the signature.
 * @evidence contracts/performance.md#efficient-algorithms Descriptor evaluation exits immediately; ordinary selection scans at most M manifest policy fields and stops on the first disabled one without copying inputs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate selects current supplied policy; the build coordinator includes its result in the generation key before admitting reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Supplied manifests remain caller-owned and no history, process or handle is retained.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The body selects only the supplied descriptor boolean and manifest plugins discriminant; native project paths, runtime environment reads and build execution belong to the caller, not this predicate.
 */
export function selectRuntimePluginPolicy(
  /** Build manifests already admitted to the current runtime. */
  manifests: readonly Pick<RuntimeManifest, "plugins">[],
  /** Whether this invocation evaluates a plugin descriptor. */
  descriptorLoad: boolean,
): false | undefined {
  return descriptorLoad ||
    manifests.some((manifest) => manifest.plugins === false)
    ? false
    : undefined;
}

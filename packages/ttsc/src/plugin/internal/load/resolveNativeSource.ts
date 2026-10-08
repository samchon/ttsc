import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import { NativeSourcePackages } from "../source/NativeSourcePackages";
import { resolvePluginGoModule } from "../source/resolvePluginGoModule";
import { pluginLabel } from "./pluginLabel";
import { requirePluginSource } from "./requirePluginSource";

/**
 * Resolve the Go module and Go-owned proposed native kind of a source.
 *
 * Nested transform proposals preserve admitted source layout under the generic
 * host's root manifests, with the tool pinned at the original module. Root and
 * check sources retain their own manifests. The loader must confirm executable
 * proposals in their full owning module and linked proposals inside each chosen
 * actual host; this adapter cannot choose that host. Go errors and empty
 * production-file selections are terminal.
 *
 * @evidence contracts/common.md#principled-implementation Real source admission and module discovery precede actual prospective-context Go metadata; only an error-free production package proposes executable or linked ownership, while final actual-context admission belongs to the loader/build.
 * @evidence contracts/common.md#clear-and-simple-design Source/module admission and selected package observation have separate owners; callers may supply this load's batched observation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No lexical scanner, filename exception or partial constraint parser substitutes for the selected Go tool.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes Go-owned package selection and erroneous-name rejection.
 * @evidence contracts/portability.md#os-neutral-implementation Native module/path and effective-environment owners preserve platform identity; Go interprets target selection.
 * @evidence contracts/performance.md#efficient-algorithms Module discovery is bounded; a missing supplied observation delegates contextual copy/workspace setup and one metadata command, without dependency compilation.
 * @evidence contracts/performance.md#reuse-equivalent-work Loader-supplied observations batch equivalent packages within one load; direct calls reobserve current inputs and retain no cross-load cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Delegated metadata scratch has retirement-aware cleanup; returned module/kind strings transfer to the caller and no source handle is retained here.
 */
export function resolveNativeSource(
  source: string,
  plugin: ITtscPlugin,
  config: ITtscProjectPluginConfig,
  index: number,
  options?: { env?: NodeJS.ProcessEnv; observation?: NativeSourcePackages.Package },
): { kind: "executable" | "linked"; moduleRoot: string } {
  const label = pluginLabel(plugin, config, index);
  requirePluginSource(source, label);
  const { moduleRoot } = resolvePluginGoModule(source, label);
  const observation = options?.observation ?? NativeSourcePackages.propose([
    { source, label, ownModule: plugin.stage === "check" },
  ], SidecarEnvironment.merge(options?.env ?? process.env))[0]!.observation;
  return { kind: NativeSourcePackages.kind(observation, label), moduleRoot };
}

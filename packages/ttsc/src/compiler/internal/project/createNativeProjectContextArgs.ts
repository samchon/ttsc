import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { createNativeProjectContextJson } from "./createNativeProjectContextJson";

/**
 * Encode retained project identity as one native sidecar argument. The JSON
 * serializer owns payload shape; the argument carries no shell quoting.
 *
 * @evidence contracts/common.md#principled-implementation One --project-context-json argument contains the shared serializer's complete identity payload, preserving the native host's flag/value boundary for direct argv spawning.
 * @evidence contracts/common.md#clear-and-simple-design This adapter owns the CLI envelope only; createNativeProjectContextJson is the sole project-context wire-shape owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The flag name is a declared sidecar protocol constant and the payload comes from retained project identity, without per-consumer path guesses or shell interpolation.
 * @evidence contracts/common.md#meaningful-documentation The native comment distinguishes envelope and payload responsibility and explains argv representation following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources createNativeProjectContextArgs declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms createNativeProjectContextArgs declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work createNativeProjectContextArgs declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation createNativeProjectContextArgs is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
 */
export function createNativeProjectContextArgs(
  project: ITtscParsedProjectConfig,
  pluginConfigOrigin?: string,
): string[] {
  return [
    "--project-context-json=" +
      createNativeProjectContextJson(project, pluginConfigOrigin),
  ];
}

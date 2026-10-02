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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The one-element argv array and encoded string transfer to the caller; this adapter retains no history or native resource.
 * @evidence contracts/performance.md#efficient-algorithms The shared serializer encodes identity bytes once, then a fixed protocol prefix and one-element array form the envelope; string work and returned storage scale with the encoded payload bytes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This invocation-data envelope coordinates no completed or in-flight producer computation.
 * @evidence contracts/portability.md#os-neutral-implementation Native path spellings stay JSON-encoded inside one argv element with no shell quoting or separator rewriting; the spawning caller owns OS process argument transport.
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

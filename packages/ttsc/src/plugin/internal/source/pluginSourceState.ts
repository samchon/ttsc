import crypto from "node:crypto";

import { pluginBuildEnvironment } from "./pluginBuildEnvironment";
import { pluginSourceDigest } from "./pluginSourceDigest";
import { processPluginBuildEnvironment } from "./processPluginBuildEnvironment";

/**
 * The state of one plugin source directory as a plugin binary is built from it:
 * the digest of its sources (`pluginSourceDigest`) together with the
 * environment a build there is keyed on (`pluginBuildEnvironment`).
 *
 * A plugin's binary is a function of both, and the plugin cache key covers both
 * (`computeCacheKey`): a changed `GOFLAGS`, cgo setting, C compiler, or Go
 * toolchain builds another binary as surely as an edited source file does. The
 * transform envelope reports this state for every source directory its binaries
 * were built from (`ITtscCompilerTransformation.ISuccess.pluginSources`), and a
 * consumer that keeps the output beyond its process proves it through the
 * `ttsc/plugin-source` entry, with no rule of its own (samchon/ttsc#1487,
 * samchon/ttsc#1493). For a plugin's own module root the environment is the one
 * its build keyed on exactly. For a contributor or an overlay, which the build
 * reads under the plugin's module root, it is the environment a build there
 * would take, which moves with every variable and tool the build's own does.
 *
 * The sources are read on every call. Under this process's own environment the
 * environment is read once per directory and set of variables
 * (`processPluginBuildEnvironment`), and a proof that must not accept a stale
 * one compares through `pluginSourceStateHolds`, which reads it again before it
 * refutes a state.
 *
 * @param directory The source directory.
 * @param options.env An effective environment other than this process's, which
 *   is read fresh.
 * @param options.sourceDigest The directory's `pluginSourceDigest`, when the
 *   caller already read it.
 * @param options.environment The directory's `pluginBuildEnvironment`, when the
 *   caller already read it, as a plugin build's key does.
 *
 * @returns The state, as lowercase hex.
 *
 * @throws When a listed source file cannot be read, as the build itself would.
 *
 * @evidence contracts/common.md#principled-implementation The state combines source and environment digests because both affect compiled plugin behavior; supplied readings preserve the exact inputs a build already keyed on.
 * @evidence contracts/common.md#clear-and-simple-design One composition function delegates source selection and environment resolution to their owning implementations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The state is derived from real source/toolchain readings rather than compile output or an assumed stable process environment.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain module-root versus overlay environment meaning and the provenance required for supplied digests.
 * @evidence contracts/portability.md#os-neutral-implementation Native source and toolchain identity are delegated to the shared filesystem/process readers; the final digest is platform-independent serialized text.
 * @evidence contracts/performance.md#efficient-algorithms Composition hashes two fixed-size digests; without supplied values its dominant work is the owning source traversal and environment validation, not an extra content scan.
 * @evidence contracts/performance.md#reuse-equivalent-work Already-read source/environment digests are accepted from their producer and process-environment readings are reused only while their path witnesses hold; explicit injected environments are read fresh.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This function retains no resource or state after returning; process-environment memo lifetime belongs to its separate owner.
 */
export function pluginSourceState(
  directory: string,
  options: {
    env?: NodeJS.ProcessEnv;
    environment?: string;
    sourceDigest?: string;
  } = {},
): string {
  return crypto
    .createHash("sha256")
    .update(
      `source=${options.sourceDigest ?? pluginSourceDigest(directory)}\n` +
        `environment=${
          options.environment ??
          (options.env === undefined
            ? processPluginBuildEnvironment(directory)
            : pluginBuildEnvironment(directory, options.env))
        }\n`,
    )
    .digest("hex");
}

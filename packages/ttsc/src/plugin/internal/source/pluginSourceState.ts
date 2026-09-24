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
 * @returns The state, as lowercase hex.
 * @throws When a listed source file cannot be read, as the build itself would.
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

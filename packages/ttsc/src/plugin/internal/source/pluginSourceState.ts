import crypto from "node:crypto";

import { PluginContentIdentities } from "./PluginContentIdentities";
import { pluginBuildEnvironment } from "./pluginBuildEnvironment";
import { processPluginBuildEnvironment } from "./processPluginBuildEnvironment";
import { provenPluginSourceDigest } from "./provenPluginSourceDigest";

/**
 * The state of one plugin source directory as a plugin binary is built from it:
 * the digest of its sources (`pluginSourceDigest`) together with the
 * environment a build there is keyed on (`pluginBuildEnvironment`).
 *
 * The plugin cache key covers both selected identities (`computeCacheKey`): a
 * changed `GOFLAGS`, cgo setting, C compiler, or Go toolchain builds another
 * binary as surely as an edited source file does. The transform envelope
 * reports this state for directories selected by the loader's pluginSources
 * policy, which omits installed ttsc directories, and a consumer that keeps the
 * output beyond its process proves it through the `ttsc/plugin-source` entry,
 * with no rule of its own. For a plugin's own module root the environment is
 * the one its build keyed on exactly. For a contributor or an overlay, which
 * the build reads under the plugin's module root, it is the environment a build
 * there would take. It is not an assertion that arbitrary directory-local tool
 * or environment resolution is identical to the host module's resolution.
 *
 * Sources are read unless the caller supplies their digest. Under this
 * process's own environment the environment is read once per directory and set
 * of variables (`processPluginBuildEnvironment`), and a proof that must not
 * accept a stale one compares through `pluginSourceStateHolds`, which reads it
 * again before it refutes a state. A caller that names its project proves the
 * sources and the SDK from that project's plugin cache records instead of
 * reading them in every new process (#1725).
 *
 * @param directory The source directory.
 * @param options.env An effective environment other than this process's, which
 *   is read fresh.
 * @param options.sourceDigest The directory's `pluginSourceDigest`, when the
 *   caller already read it.
 * @param options.environment The directory's `pluginBuildEnvironment`, when the
 *   caller already read it, as a plugin build's key does.
 * @param options.projectRoot Project whose plugin cache root holds the records.
 * @returns The state, as lowercase hex.
 * @throws When a listed source file cannot be read, as the build itself would.
 * @evidence contracts/common.md#principled-implementation The state combines source and environment digests because both affect compiled plugin behavior; supplied readings preserve the exact inputs a build already keyed on.
 * @evidence contracts/common.md#clear-and-simple-design One composition function delegates source selection and environment resolution to their owning implementations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The state is derived from real source/toolchain readings rather than compile output or an assumed stable process environment.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain module-root versus overlay environment meaning and the provenance required for supplied digests.
 * @evidence contracts/portability.md#os-neutral-implementation Native source and toolchain identity are delegated to the shared filesystem/process readers; the final digest is platform-independent serialized text.
 * @evidence contracts/performance.md#efficient-algorithms Composition serializes/hashes supplied digest strings whose public inputs are not length-validated; owning generated digests are fixed-width hex. Missing readings delegate native source enumeration/full reads and environment variable/witness/tool/SDK work, without establishing an unmeasured dominant cost ranking.
 * @evidence contracts/performance.md#reuse-equivalent-work Supplied source/environment strings are trusted producer readings, not independently revalidated here. Process-environment memos require their owner's variable/path witness checks; explicit injected environments are read fresh. A named project lets missing source and SDK readings come from its record store across processes. Equality inherits the selected-source and native metadata premises.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This function retains no resource or state after returning; process-environment memo lifetime belongs to its separate owner.
 */
export function pluginSourceState(
  directory: string,
  options: {
    env?: NodeJS.ProcessEnv;
    environment?: string;
    projectRoot?: string;
    sourceDigest?: string;
  } = {},
): string {
  const sourceDigest =
    options.sourceDigest ??
    provenPluginSourceDigest(directory, options.projectRoot, options.env);
  const environment =
    options.environment ??
    (options.env === undefined
      ? processPluginBuildEnvironment(directory, false, options.projectRoot)
      : pluginBuildEnvironment(
          directory,
          options.env,
          undefined,
          options.projectRoot === undefined
            ? undefined
            : PluginContentIdentities.open({
                projectRoot: options.projectRoot,
                env: options.env,
                sources: [directory],
              }),
        ));
  return crypto
    .createHash("sha256")
    .update(`source=${sourceDigest}\nenvironment=${environment}\n`)
    .digest("hex");
}

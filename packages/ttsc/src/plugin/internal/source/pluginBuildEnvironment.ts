import crypto from "node:crypto";
import fs from "node:fs";

import { GoToolResolution } from "./GoToolResolution";
import type { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
import { resolveGoCompiler } from "./resolveGoCompiler";

/**
 * The digest of the environment a plugin build in `directory` is keyed on: the
 * Go compiler the build resolves there, the Go build environment `go env`
 * reports there, and the external toolchain environment
 * (`hashPluginBuildEnvironment`).
 *
 * The compiler is resolved as the build resolves it (`resolveGoCompiler`, then
 * the toolchain `directory` selects), so for a plugin's own module root this is
 * the selected identity used by its binary key; it does not certify arbitrary
 * unobserved tool/launcher inputs. A normal reading probes `go
 * env` and walks GOROOT metadata. Witnessing a newly selected environment file
 * can repeat the probe to observe it before reading. Compiler identity reuses a
 * metadata-and-context memo; a changed SDK manifest rehashes all contributing
 * content rather than only edited files.
 *
 * @param directory The directory a build runs `go` in.
 * @param env The effective environment, `process.env` by default.
 * @param witness Receives the paths the reading depends on and no variable
 *   carries (`hashPluginBuildEnvironment`).
 *
 * @evidence contracts/common.md#principled-implementation The digest uses the same resolved compiler and environment serializer as the binary key, so reported toolchain state denotes the inputs actually used by the build.
 * @evidence contracts/common.md#clear-and-simple-design Compiler selection, executable resolution and hashing each stay with their owning helper; this function only composes one environment reading.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The result comes from real Go/environment inputs, not a fixed compiler version or a caller-specific substitute.
 * @evidence contracts/common.md#meaningful-documentation Native documentation identifies the module-directory meaning, cost and witness output, with parameter descriptions and separated acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Executable identity is resolved before probing, and Node filesystem/process boundaries implement native spelling rather than assuming Windows or POSIX paths are interchangeable.
 * @evidence contracts/performance.md#efficient-algorithms The wrapper resolves the compiler/tool under the supplied environment before delegating full environment hashing. Native resolution/probes, SDK metadata/name/path sorting and changed-manifest full content reads contribute cost; the final hash output is fixed-width but streamed identity/input text and full-file buffers are not. No independent duplicate source-directory digest scan is added here.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This is the fresh-reading boundary required by builds; processPluginBuildEnvironment owns reuse when a consumer permits it.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Its digest and filesystem adapter are call-local; retained compiler/content memo ownership belongs to the hasher.
 */
export function pluginBuildEnvironment(
  directory: string,
  env: NodeJS.ProcessEnv = process.env,
  witness?: PluginBuildEnvironmentWitness.Record,
): string {
  const goBinary = GoToolResolution.resolveGoToolForBuild(
    resolveGoCompiler(env).binary,
    env,
    directory,
    witness,
  );
  const hash = crypto.createHash("sha256");
  hashPluginBuildEnvironment(
    hash,
    goBinary,
    directory,
    env,
    { readFile: (location) => fs.readFileSync(location) },
    witness,
  );
  return hash.digest("hex");
}

import crypto from "node:crypto";
import path from "node:path";

import type { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import { WitnessedLoadAnswers } from "./WitnessedLoadAnswers";
import { goToolVariables } from "./goToolVariables";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
import { readSourceBuildFile } from "./readSourceBuildFile";

/**
 * The digest of the environment a plugin build in `directory` is keyed on
 * (`hashPluginBuildEnvironment`), taken from a record a previous process left
 * while everything the recorded reading depended on still holds.
 *
 * A reading runs `go env` and identifies GOROOT. Its record keys the caller's
 * environment through `goToolVariables`, including its optional exclusion of
 * launch state. The witness covers the Go executable, Go's environment file,
 * toolchain selection files, C toolchain executables and GOROOT. This proof is
 * shared within a process by `processPluginBuildEnvironment` and across
 * processes by `WitnessedLoadAnswers`. The caller receives the witness so it
 * can compare the same inputs after a build.
 *
 * @param goBinary The Go tool the build runs, or `undefined` for none.
 * @param directory The directory a build runs `go` in.
 * @param env The effective environment of the build.
 * @param witness Receives the paths the reading depends on.
 * @param identities Record store of the project's plugin cache; without it
 *   every call reads.
 * @param currentReadings Optional caller-owned map sharing current native
 *   witness readings across one synchronous batch of recorded-answer checks.
 * @param projectRoot The consuming project whose tree excludes temporary
 *   output.
 * @returns The environment digest.
 * @evidence contracts/common.md#principled-implementation The Go tool environment projection and the pre-read metadata witness qualify a recorded digest. A reading is recorded only after its witness held around it.
 * @evidence contracts/common.md#clear-and-simple-design One function owns the record family, so package selection, the binary key and the source state read the environment the same way.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No Go value is assumed: a missing, malformed or moved record reads Go again, and an unwitnessable reading is never recorded.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the two dependencies, the excluded variables and the admission rule.
 * @evidence contracts/portability.md#os-neutral-implementation Variables pass through the shared native-name merger. The key keeps the original cwd and a base for relative directories, and the witness keeps native path, link and stat identity.
 * @evidence contracts/performance.md#efficient-algorithms A hit hashes the variables once, parses one record and stats each witnessed path once per synchronous batch; a miss adds the reading it replaces and one witness validation.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal variables, Go tool and directory share one reading across processes while its witness holds; an optional caller-owned synchronous batch map shares current witness stat observations across directories checked together and is dropped when the batch ends.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Records are single files in the plugin cache's answer directory, aged by its collector and removed by `ttsc clean`; nothing is retained in memory.
 */
export function readPluginBuildEnvironment(
  goBinary: string | undefined,
  directory: string,
  env: NodeJS.ProcessEnv,
  witness: PluginBuildEnvironmentWitness.Record | undefined,
  identities: PluginContentIdentities.Store | undefined,
  currentReadings?: Map<string, string>,
  projectRoot?: string,
): string {
  const identity = [
    // Older answers do not carry the current native cwd and delegation proof.
    7,
    goBinary ?? null,
    directory,
    path.isAbsolute(directory) ? null : process.cwd(),
    goToolVariables(env),
  ];
  const kept = WitnessedLoadAnswers.read(
    identities,
    KIND,
    identity,
    (value): value is string => typeof value === "string",
    currentReadings,
  );
  if (kept !== undefined) {
    WitnessedLoadAnswers.join(witness, kept.witness);
    return kept.value;
  }
  const observed: PluginBuildEnvironmentWitness.Record = new Map();
  const hash = crypto.createHash("sha256");
  hashPluginBuildEnvironment(
    hash,
    goBinary,
    directory,
    env,
    { readFile: readSourceBuildFile, readRawFile: readSourceBuildFile },
    observed,
    identities,
    projectRoot,
  );
  const environment = hash.digest("hex");
  WitnessedLoadAnswers.join(witness, observed);
  WitnessedLoadAnswers.write(identities, KIND, identity, environment, observed);
  return environment;
}

/** Answer family of build-environment readings (`WitnessedLoadAnswers`). */
const KIND = "plugin-build-environment";

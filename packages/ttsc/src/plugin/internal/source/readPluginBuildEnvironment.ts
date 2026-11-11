import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import { WitnessedLoadAnswers } from "./WitnessedLoadAnswers";
import { goToolVariables } from "./goToolVariables";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";

/**
 * The digest of the environment a plugin build in `directory` is keyed on
 * (`hashPluginBuildEnvironment`), taken from a record a previous process left
 * while everything the recorded reading depended on still holds.
 *
 * A reading runs `go env` and `go version` and walks GOROOT, seconds a load,
 * and every launch is a new process (samchon/ttsc#1852). What a reading depends
 * on is two things. One is the variables the Go tool receives, which are all of
 * them, so the record is keyed by every variable except ttsc's own per-run
 * channels, which name one run's directories and which no Go tool reads
 * (`goToolVariables`). The other is the metadata of every path no variable
 * carries: the Go tool, the file `go env -w` writes, the executables the C
 * toolchain commands name and GOROOT (`PluginBuildEnvironmentWitness`). A
 * process keeps a reading under exactly that proof
 * (`processPluginBuildEnvironment`); the record carries the same proof to the
 * next process (`WitnessedLoadAnswers`). A recorded reading's witness joins the
 * caller's, so a build still compares it after it ran.
 *
 * @param goBinary The Go tool the build runs, or `undefined` for none.
 * @param directory The directory a build runs `go` in.
 * @param env The effective environment of the build.
 * @param witness Receives the paths the reading depends on.
 * @param identities Record store of the project's plugin cache; without it
 *   every call reads.
 * @returns The environment digest.
 * @evidence contracts/common.md#principled-implementation A recorded digest is served only under the variables the Go tool receives and the pre-read metadata witness of every path no variable carries, the same proof under which a process already keeps a reading; a reading is recorded only after its witness held around it.
 * @evidence contracts/common.md#clear-and-simple-design One function owns the record family, so package selection, the binary key and the source state read the environment the same way.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No Go value is assumed: a missing, malformed or moved record reads Go again, and an unwitnessable reading is never recorded.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the two dependencies, the excluded variables and the admission rule.
 * @evidence contracts/portability.md#os-neutral-implementation Variables pass through the shared native-name merger, and the witness keeps native path, link and stat identity.
 * @evidence contracts/performance.md#efficient-algorithms A hit hashes the variables once, parses one record and stats each witnessed path once; a miss adds the reading it replaces and one witness validation.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal variables, Go tool and directory share one reading across processes while its witness holds.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Records are single files in the plugin cache's answer directory, aged by its collector and removed by `ttsc clean`; nothing is retained in memory.
 */
export function readPluginBuildEnvironment(
  goBinary: string | undefined,
  directory: string,
  env: NodeJS.ProcessEnv,
  witness: PluginBuildEnvironmentWitness.Record | undefined,
  identities: PluginContentIdentities.Store | undefined,
): string {
  const identity = [
    goBinary ?? null,
    path.resolve(directory),
    goToolVariables(env),
  ];
  const kept = WitnessedLoadAnswers.read(
    identities,
    KIND,
    identity,
    (value): value is string => typeof value === "string",
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
    { readFile: (location) => fs.readFileSync(location) },
    observed,
    identities,
  );
  const environment = hash.digest("hex");
  WitnessedLoadAnswers.join(witness, observed);
  WitnessedLoadAnswers.write(identities, KIND, identity, environment, observed);
  return environment;
}

/** Answer family of build-environment readings (`WitnessedLoadAnswers`). */
const KIND = "plugin-build-environment";

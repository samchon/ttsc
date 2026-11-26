import crypto from "node:crypto";

import { runtimeBuildEnvironment } from "../../../compiler/internal/build/runtimeBuildEnvironment";
import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Environment fingerprint of a Go reading recorded for later processes.
 *
 * By default every variable the Go tool can receive enters the fingerprint,
 * except ttsc's per-run channels and reporting switches. Setting
 * `TTSC_CACHE_IGNORE_GO_LAUNCH_ENV=1` excludes the listed launch variables from
 * recorded Go tool queries. Use it when the Go tool, wrappers and downstream
 * toolchains return the same answers as those variables change. The subprocess
 * receives the caller's environment in either mode.
 *
 * @param env Effective environment of the Go invocation.
 * @returns Hex SHA-256 of the name-ordered variables.
 * @evidence contracts/common.md#principled-implementation Other than ttsc's own per-run controls, all variables are keyed by default. Only an explicit assertion of toolchain independence excludes the named launch variables.
 * @evidence contracts/common.md#clear-and-simple-design This projection owns the Go-specific opt-in and shares ttsc's per-run exclusions with the existing runtime projection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Arbitrary environment values remain keyed and the opt-in never changes the environment passed to tools.
 * @evidence contracts/common.md#meaningful-documentation Native prose states what is keyed, what is left out and why.
 * @evidence contracts/portability.md#os-neutral-implementation The shared native-name merger normalizes aliases on Windows and keeps case-sensitive names on POSIX.
 * @evidence contracts/performance.md#efficient-algorithms One sort and one pass over the variables.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure projection coordinates no shared work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
 */
export function goToolVariables(env: NodeJS.ProcessEnv): string {
  const environment = SidecarEnvironment.merge(env);
  const ignoreLaunchEnvironment =
    environment.TTSC_CACHE_IGNORE_GO_LAUNCH_ENV === "1";
  const hash = crypto.createHash("sha256");
  for (const [name, value] of Object.entries(environment)
    .filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        !runtimeBuildEnvironment.unkeyed(entry[0]) &&
        !(ignoreLaunchEnvironment && GO_LAUNCH_ENVIRONMENT.has(entry[0])),
    )
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
    hash.update(`\0${name.length}:${name}${value.length}:${value}`);
  return hash.digest("hex");
}

/** Jobserver, cowshed, direnv and shell launch state covered by the opt-in. */
const GO_LAUNCH_ENVIRONMENT: ReadonlySet<string> = new Set([
  "MAKEFLAGS",
  "CARGO_MAKEFLAGS",
  "COWSHED_INSTALL_OBSERVED",
  "DIRENV_DIFF",
  "DIRENV_WATCHES",
  "OLDPWD",
  "SHLVL",
]);

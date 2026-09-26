import crypto from "node:crypto";

import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { pluginBuildEnvironment } from "./pluginBuildEnvironment";

/**
 * The build environments this process read, by directory and by the process's
 * variables at the read, each with the metadata of the paths it depended on.
 */
const read = new Map<
  string,
  { environment: string; witness: PluginBuildEnvironmentWitness.Record }
>();

/**
 * The environment a plugin build in `directory` is keyed on under this
 * process's variables (`pluginBuildEnvironment`), read once per process and
 * directory while what it depended on holds, unless `refresh` asks for it
 * again.
 *
 * Reading it runs `go env`, walks GOROOT's metadata, and, once per compiler
 * binary, runs `go version` and reads the binary: seconds on some hosts. A
 * consumer that proves a plugin source's state for every adoption, record, or
 * delivery would pay that each time, for an environment that changes with the
 * process's variables and otherwise almost never. The read is therefore kept
 * under the variables it was taken with, all of them, so a changed variable
 * reads it again, and with the metadata of every path it depended on that no
 * variable carries (`PluginBuildEnvironmentWitness`): the Go tool, the Go
 * environment file `go env -w` writes, the executables the C toolchain commands
 * name, and GOROOT. A kept read is reused only while each of them holds its
 * metadata, so a toolchain replaced in place or a `go env -w` is read at the
 * next use, not after a proof has already accepted the old reading
 * (samchon/ttsc#1516). The build itself never reads through here: it keys each
 * binary on a fresh read.
 *
 * @param directory The directory a build runs `go` in.
 * @param refresh Whether to read the environment again rather than reuse it.
 */
export function processPluginBuildEnvironment(
  directory: string,
  refresh = false,
): string {
  const variables = crypto.createHash("sha256");
  for (const [key, value] of Object.entries(process.env).sort(
    ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
  )) {
    if (value !== undefined)
      variables.update(`${key.length}:${key}${value.length}:${value}\0`);
  }
  const key = `${directory}\0${variables.digest("hex")}`;
  if (!refresh) {
    const known = read.get(key);
    if (
      known !== undefined &&
      PluginBuildEnvironmentWitness.holds(known.witness)
    )
      return known.environment;
  }
  const witness: PluginBuildEnvironmentWitness.Record = new Map();
  const environment = pluginBuildEnvironment(directory, process.env, witness);
  read.set(key, { environment, witness });
  return environment;
}

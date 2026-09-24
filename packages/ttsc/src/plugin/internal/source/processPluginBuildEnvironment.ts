import crypto from "node:crypto";

import { pluginBuildEnvironment } from "./pluginBuildEnvironment";

/**
 * The build environments this process read, by directory and by the process's
 * variables at the read.
 */
const read = new Map<string, string>();

/**
 * The environment a plugin build in `directory` is keyed on under this
 * process's variables (`pluginBuildEnvironment`), read once per process and
 * directory unless `refresh` asks for it again.
 *
 * Reading it runs `go env`, walks GOROOT's metadata, and, once per compiler
 * binary, runs `go version` and reads the binary: seconds on some hosts. A
 * consumer that proves a plugin source's state for every adoption, record, or
 * delivery would pay that each time, for an environment that changes with the
 * process's variables and otherwise almost never. The read is therefore kept
 * under the variables it was taken with, all of them, so a changed variable
 * reads it again. A change no variable carries, `go env -w` or a toolchain
 * replaced in place, is read when a proof finds a state it cannot match and
 * asks again (`pluginSourceStateHolds`), and by every later process. The build
 * itself never reads through here: it keys each binary on a fresh read.
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
    if (known !== undefined) return known;
  }
  const environment = pluginBuildEnvironment(directory);
  read.set(key, environment);
  return environment;
}

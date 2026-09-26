import crypto from "node:crypto";
import fs from "node:fs";

import { GoToolResolution } from "./GoToolResolution";
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
 * exactly the environment its binary was keyed on. It costs one `go env` run,
 * one GOROOT metadata walk, and, once per process and compiler binary, one `go
 * version` run and a read of the binary.
 *
 * @param directory The directory a build runs `go` in.
 * @param env The effective environment, `process.env` by default.
 * @param witness Receives the paths the reading depends on and no variable
 *   carries (`hashPluginBuildEnvironment`).
 */
export function pluginBuildEnvironment(
  directory: string,
  env: NodeJS.ProcessEnv = process.env,
  witness?: Set<string>,
): string {
  const goBinary = GoToolResolution.resolveGoToolForBuild(
    resolveGoCompiler(env).binary,
    env,
    directory,
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

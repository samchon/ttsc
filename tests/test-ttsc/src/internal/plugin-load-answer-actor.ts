import path from "node:path";

import { CompilerTarget } from "../../../../packages/ttsc/src/plugin/internal/source/CompilerTarget";
import { PluginContentIdentities } from "../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";

// A launch is a new process: this actor resolves the compiler target of a
// project named by a custom binary under a freshly opened record store, as
// every plugin load of a ttsx program does, and prints the selected line.
const [root, binary] = process.argv.slice(2) as [string, string];
const env = { PATH: process.env.PATH, TTSC_TSGO_BINARY: binary };
const store = PluginContentIdentities.open({
  projectRoot: root,
  cacheDir: path.join(root, "cache"),
  env,
});
process.stdout.write(CompilerTarget.resolve(root, env, store));

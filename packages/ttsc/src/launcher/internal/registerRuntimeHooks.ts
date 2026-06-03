import { installHooks } from "./runtime/runtimeHooks";
import { startEmitClient } from "./runtime/syncEmit";

/**
 * `--import` entry point installed in the child process that runs the entry.
 *
 * It starts the synchronous emit client (a worker bridging to the persistent
 * native host the parent selected) and registers the module hooks, so every
 * `.ts` the entry reaches is emitted on demand through its owning program. The
 * parent passes the host binary, its arguments, the working directory, and the
 * entry's tsconfig through the environment so this module stays small and loads
 * in plain Node.
 */
const serverBin = process.env["TTSX_EMIT_HOST_BIN"];
const cwd = process.env["TTSX_EMIT_HOST_CWD"] ?? process.cwd();
const entryTsconfig = process.env["TTSX_ENTRY_TSCONFIG"] ?? "";

if (serverBin !== undefined && serverBin !== "") {
  let serverArgs: string[] = [];
  try {
    serverArgs = JSON.parse(process.env["TTSX_EMIT_HOST_ARGS"] ?? "[]");
  } catch {
    serverArgs = [];
  }
  startEmitClient({ serverBin, serverArgs, cwd });
  installHooks(entryTsconfig);
}

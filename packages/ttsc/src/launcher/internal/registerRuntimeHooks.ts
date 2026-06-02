import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { installCjsHooks } from "./runtime/cjsHooks";

/**
 * `--import` entry point that installs `ttsx`'s runtime module hooks in the
 * child process and every Node subprocess it spawns (the registrar is forwarded
 * through `NODE_OPTIONS`).
 *
 * Two layers run side by side: the ESM `resolve`/`load` hooks registered off
 * the loader thread, and the synchronous CommonJS loader patch installed on the
 * main thread. Both read the same runtime environment and no-op when the
 * process was not launched by `ttsx`, so an unrelated `node` child that merely
 * inherits the registrar pays nothing.
 */
register(pathToFileURL(path.join(__dirname, "runtimeHooks.js")).href);
installCjsHooks();

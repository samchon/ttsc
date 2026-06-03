import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * `--import` entry point that installs `ttsx`'s runtime module hooks in the
 * child process. Run before the compiled entry so the `resolve`/`load` hooks in
 * `runtimeHooks` are active for the whole dependency graph.
 *
 * Kept as a dedicated, dependency-free module: it must load in the child's
 * plain Node runtime (not ttsc's), so it pulls in nothing beyond Node builtins
 * and the sibling hooks file.
 */
register(pathToFileURL(path.join(__dirname, "runtimeHooks.js")).href);

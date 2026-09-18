import { installRuntimeHooks } from "./runtime/installRuntimeHooks";

/**
 * `--require` target that only installs the runtime module hooks. `ttsx` puts
 * it on `NODE_OPTIONS` for the child process so every descendant the program
 * spawns (e.g. a worker started with `node worker.ts`) inherits the same
 * source-loading hooks, the way `ts-node` propagates through `--require
 * ts-node/register`. The preload itself is CommonJS and only registers the
 * hooks; ESM support comes from the `registerHooks` they install, not from how
 * the preload is loaded. The entry process gets it the same way, which is what
 * lets Node load the entry itself as its main module; here we only register
 * (idempotently).
 */
installRuntimeHooks();

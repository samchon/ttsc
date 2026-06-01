import { registerHooks } from "node:module";

import { resolve } from "./runtimeHooks.js";

/**
 * `--import` entry point that installs `ttsx`'s runtime module hook before the
 * compiled entry runs.
 *
 * Uses the synchronous, in-thread `registerHooks` rather than the asynchronous
 * `register`: `registerHooks` customizes BOTH `import` and `require`, while
 * `register` only reaches the ESM loader. A dependency's `.ts` pulled in
 * through `require` — the normal path for a CommonJS-emitted entry and its
 * graph — must be redirected to tsgo's emit exactly like one reached through
 * `import`.
 */
registerHooks({ resolve });

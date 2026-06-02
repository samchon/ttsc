import { registerHooks } from "node:module";

import { installCommonJsHooks, load, resolve } from "./runtimeHooks.js";

/**
 * `--import` entry point that installs `ttsx`'s runtime module hooks before the
 * entry runs.
 *
 * Uses the synchronous, in-thread `registerHooks` rather than the asynchronous
 * `register`: `registerHooks` customizes BOTH `import` and `require`, while
 * `register` only reaches the ESM loader. A `.ts` pulled in through `require` —
 * the normal path for a CommonJS entry and its graph — must be served from
 * tsgo's emit exactly like one reached through `import`.
 *
 * `resolve` keeps each `.ts` at its own source URL (mapping compiler-emitted
 * sibling specifiers back to source); `load` serves the compiled JavaScript as
 * that source's bytes. The source identity is what makes `import.meta.url`,
 * `__dirname`, and relative asset reads point at the real source tree.
 */
registerHooks({ load, resolve });
installCommonJsHooks();

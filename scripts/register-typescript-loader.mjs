import { registerHooks } from "node:module";

import { load, resolve } from "./typescript-loader.mjs";

registerHooks({ load, resolve });
// The loader inlines a source map into every module it compiles, so a failure
// reports the TypeScript line it happened on.
process.setSourceMapsEnabled(true);

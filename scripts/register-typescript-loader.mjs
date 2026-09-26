import { register } from "node:module";

register(new URL("./typescript-loader.mjs", import.meta.url));
// The loader inlines a source map into every module it compiles, so a failure
// reports the TypeScript line it happened on.
process.setSourceMapsEnabled(true);

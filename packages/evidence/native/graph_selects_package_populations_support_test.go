package evidence

const packageManifest = `{
  "name": "@org/api",
  "main": "./lib/index.js",
  "exports": { ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" } }
}`













// nestedAccessorPackage is the shape a generated SDK installs: an entry that
// nests its surface one namespace segment at a time, so the address a consumer
// writes is several segments longer than the module that declares the symbol.
func nestedAccessorPackage() map[string]string {
  return map[string]string{
    "node_modules/@org/api/package.json": packageManifest,
    "node_modules/@org/api/lib/index.d.ts": `
export * as functional from "./functional/index.js";
`,
    "node_modules/@org/api/lib/functional/index.d.ts": `
export * as health from "./health/index.js";
export * as reviews from "./reviews/index.js";
`,
    "node_modules/@org/api/lib/functional/health/index.d.ts":  "export declare function get(): void;\n",
    "node_modules/@org/api/lib/functional/reviews/index.d.ts": "export declare function erase(): void;\n",
    "src/views/detail.ts": `import type * as api from "@org/api";

/** @evidence {@link api.functional.health.get} Renders this operation's response. */
export function detail(): void {}
`,
  }
}

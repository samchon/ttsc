import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { RuntimeLoaderCapabilities } from "../../../../../packages/ttsc/lib/launcher/internal/runtime/RuntimeLoaderCapabilities.js";

/**
 * Verifies ttsx serves a CommonJS TypeScript graph an ESM import reaches
 * through `module.registerHooks` alone, with no private loader slot assigned
 * where the hooks reach.
 *
 * The runtime assigned handlers into `Module._extensions` and replaced
 * `Module._resolveFilename` for the whole process, because a CommonJS module
 * handed to the ESM loader with source resolved its own `require()` past the
 * hooks on some releases (samchon/ttsc#1517). Such a module is now served to an
 * ESM importer as a facade that loads it through the CommonJS loader, whose
 * `require()` the hooks see on every release. `require.resolve` is the one
 * resolution the hooks miss on some releases, and only there is it rescued.
 *
 * 1. Give a CommonJS project an ESM entry that imports a CommonJS module, which
 *    requires `./target.js` backed only by `target.ts` and resolves it through
 *    `require.resolve`, relatively and in the `{ paths }` form.
 * 2. Run the entry through ttsx.
 * 3. Assert the require and both resolutions reached the source, the importer saw
 *    the module's named export, the `.ts` key carries Node's own `.js` handler
 *    rather than a ttsx one (samchon/ttsc#1560), and the resolver is Node's own
 *    wherever `require.resolve` consults the hooks.
 */
export const test_ttsx_serves_commonjs_typescript_through_the_supported_hooks_alone =
  () => {
    const root = TestProject.commonJsProject({
      "src/config.ts": [
        `declare const require: any;`,
        `declare const __dirname: string;`,
        `const Module = require("node:module");`,
        `export const target: string = require("./target.js").value;`,
        `export const resolved: boolean = require.resolve("./target.js").endsWith("target.ts");`,
        `export const resolvedFromPaths: boolean = require`,
        `  .resolve("./target.js", { paths: [__dirname] })`,
        `  .endsWith("target.ts");`,
        `export const handler: boolean = require.extensions[".ts"] === require.extensions[".js"];`,
        `export const wrapped: boolean = Module._resolveFilename.name === "resolveFilename";`,
        ``,
      ].join("\n"),
      "src/entry.mts": [
        `void (async () => {`,
        `const loaded = await import("./config.js");`,
        `console.log(JSON.stringify({`,
        `  handler: loaded.handler,`,
        `  resolved: loaded.resolved,`,
        `  resolvedFromPaths: loaded.resolvedFromPaths,`,
        `  target: loaded.target,`,
        `  wrapped: loaded.wrapped,`,
        `}));`,
        `})();`,
        ``,
      ].join("\n"),
      "src/target.ts": `export const value: string = "SERVED";\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/entry.mts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      handler: true,
      resolved: true,
      resolvedFromPaths: true,
      target: "SERVED",
      wrapped: !RuntimeLoaderCapabilities.requireResolveConsultsHooks(),
    });
  };

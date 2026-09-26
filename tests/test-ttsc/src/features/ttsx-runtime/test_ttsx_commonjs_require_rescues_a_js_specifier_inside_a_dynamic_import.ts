import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx maps a `.js` specifier back to its TypeScript source from a
 * CommonJS module the ESM loader evaluated.
 *
 * TypeScript asks authors to write the emitted `.js` extension in a relative
 * specifier, and the resolve hook rescues that spelling. A CommonJS module an
 * ESM `import` reaches is how a plugin loads a discovered config, and a
 * CommonJS module handed to the ESM loader with source resolves its own
 * `require()` past the hooks on some releases, so `require("./x.js")` failed
 * there (samchon/ttsc#1280). ttsx serves such a module to its importer as a
 * facade that loads it through the CommonJS loader, whose `require()` the hooks
 * see on every release (samchon/ttsc#1517).
 *
 * 1. Give a CommonJS project an ESM entry that reaches a sibling by `import()`.
 * 2. Have that CommonJS sibling import `./target.js`, backed only by `target.tsx`.
 * 3. Run the entry through the real ttsx launcher and assert it resolved.
 */
export const test_ttsx_commonjs_require_rescues_a_js_specifier_inside_a_dynamic_import =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/config.ts": `
          import target from "./target.js";
          export default target;
        `,
        "src/entry.mts": `
          void (async () => {
            const loaded = await import("./config.js");
            console.log(JSON.stringify(loaded.default));
          })();
        `,
        "src/target.tsx": `
          export default "RESCUED";
        `,
      },
      { compilerOptions: { jsx: "react-jsx" } },
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/entry.mts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    // The config module is CommonJS, so its `export default` arrives as
    // `module.exports.default`; the point is that it arrived at all.
    assert.equal(result.stdout.trim(), '{"default":"RESCUED"}');
  };

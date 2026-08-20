import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx maps a `.js` specifier back to its TypeScript source from a
 * CommonJS module the ESM loader evaluated.
 *
 * TypeScript asks authors to write the emitted `.js` extension in a relative
 * specifier, and the ESM resolve hook has always rescued that spelling. The
 * CommonJS graph could not: `Module._extensions` decides how a file that was
 * found gets compiled, and Node reuses its keys only when it probes an
 * extensionless request, so `require("./x")` reached `x.ts` for free while
 * `require("./x.js")` failed to resolve before any compiler was consulted.
 *
 * That graph is reached by every `require()` inside a CommonJS module the ESM
 * loader evaluated, which is exactly how a plugin loads a discovered config: on
 * Node 22 `module.registerHooks` observes the `import()` of that module and
 * nothing within it, while Node 24 routes the same `require` through the hooks.
 * ttsx declares `engines.node` `>=22.15.0`, so the rescue belongs to ttsx
 * rather than to the runtime (samchon/ttsc#1280).
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

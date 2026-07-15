import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../internal/TestPaths";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/paths plugin: an exact `.json` alias keeps the copied
 * extension in CommonJS emit.
 *
 * Under `resolveJsonModule`, TypeScript-Go copies the JSON asset to `outDir`
 * under its own name, but the output-path predictor used to treat every
 * unrecognized source extension as JavaScript and rewrote `@data` to a
 * nonexistent `./data.js`. The build then succeeded while `node` failed with
 * `MODULE_NOT_FOUND`. This pins the copied-asset extension end to end: the
 * emitted `require` must name `./data.json`, that file must exist, no `.js`
 * sibling may be invented, and the program must actually run.
 *
 * 1. Build a CommonJS `resolveJsonModule` project whose `@data` alias targets
 *    `./src/data.json`, imported from `src/main.ts`.
 * 2. Run real `ttsc --emit`, then execute the emitted `dist/main.js` with Node.
 * 3. Assert the emit requires `./data.json`, `dist/data.json` exists, no
 *    `dist/data.js` was invented, and the program prints the JSON payload.
 */
export const test_paths_rewrites_commonjs_json_alias_to_copied_extension =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          target: "ES2022",
          resolveJsonModule: true,
          esModuleInterop: true,
          rootDir: "src",
          outDir: "dist",
          paths: { "@data": ["./src/data.json"] },
          plugins: [{ transform: "@ttsc/paths" }],
        },
        include: ["src"],
      }),
      "src/data.json": JSON.stringify({ name: "ttsc", answer: 42 }, null, 2),
      "src/main.ts": [
        `import data from "@data";`,
        `console.log(data.name + ":" + data.answer);`,
        ``,
      ].join("\n"),
    });
    TestPaths.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestPaths.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);

    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /require\("\.\/data\.json"\)/);
    assert.doesNotMatch(js, /require\("\.\/data\.js"\)/);
    assert.doesNotMatch(js, /@data/);

    assert.ok(
      fs.existsSync(path.join(root, "dist", "data.json")),
      "dist/data.json must be copied by the compiler",
    );
    assert.ok(
      !fs.existsSync(path.join(root, "dist", "data.js")),
      "no invented dist/data.js sibling may exist",
    );

    const run = TestProject.runNode(path.join(root, "dist", "main.js"), {
      cwd: root,
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /ttsc:42/);
  };

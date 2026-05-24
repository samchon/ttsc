import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../internal/TestPaths";

/**
 * Verifies the @ttsc/paths plugin: allowJs extensionless targets use emitted
 * extensions.
 *
 * `allowJs` projects include JavaScript-family source files in the Program.
 * When a paths target omits the source extension, the plugin must find those
 * files and rewrite aliases to the actual emitted runtime suffix rather than a
 * blanket `.js` suffix.
 *
 * 1. Build an allowJs project with aliases targeting `.js`, `.mjs`, `.cjs`, and
 *    `.jsx` sources by extensionless paths.
 * 2. Run real ttsc with `@ttsc/paths`.
 * 3. Assert emitted ESM/CJS outputs use `.js`, `.mjs`, `.cjs`, and `.jsx`.
 */
export const test_paths_rewrites_allow_js_extensionless_targets_to_emitted_extensions =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          allowJs: true,
          checkJs: false,
          jsx: "preserve",
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "Bundler",
          paths: {
            "@lib/plain": ["./src/modules/plain"],
            "@lib/native": ["./src/modules/native"],
            "@lib/legacy": ["./src/modules/legacy"],
            "@lib/view": ["./src/modules/view"],
          },
          outDir: "dist",
          rootDir: "src",
          plugins: [{ transform: "@ttsc/paths" }],
        },
        include: ["src"],
      }),
      "src/main.mts": [
        `import { plain } from "@lib/plain";`,
        `import { native } from "@lib/native";`,
        `import { view } from "@lib/view";`,
        `export const value = plain + native + view;`,
        ``,
      ].join("\n"),
      "src/modules/legacy.cjs": `exports.legacy = "cjs";\n`,
      "src/modules/native.mjs": `export const native = "mjs";\n`,
      "src/modules/plain.js": `export const plain = "js";\n`,
      "src/modules/view.jsx": `export const view = "jsx";\n`,
      "src/types/native.d.ts": `declare module "@lib/native" { export const native: string; }\n`,
      "src/require-consumer.cts": [
        `declare const require: (id: string) => unknown;`,
        `export const loaded = require("@lib/legacy");`,
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
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-paths-allow-js-"),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);

    for (const file of [
      "dist/modules/plain.js",
      "dist/modules/native.mjs",
      "dist/modules/legacy.cjs",
      "dist/modules/view.jsx",
    ]) {
      assert.equal(fs.existsSync(path.join(root, file)), true, file);
    }

    const mjs = fs.readFileSync(path.join(root, "dist", "main.mjs"), "utf8");
    assert.match(mjs, /from "\.\/modules\/plain\.js"/);
    assert.match(mjs, /from "\.\/modules\/native\.mjs"/);
    assert.match(mjs, /from "\.\/modules\/view\.jsx"/);
    assert.doesNotMatch(mjs, /@lib\//);

    const cjs = fs.readFileSync(
      path.join(root, "dist", "require-consumer.cjs"),
      "utf8",
    );
    assert.match(cjs, /require\("\.\/modules\/legacy\.cjs"\)/);
    assert.doesNotMatch(cjs, /@lib\/legacy/);
  };

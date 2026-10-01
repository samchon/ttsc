import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../../../internal/TestPaths";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Real emit must produce JS/MJS/CJS/JSX target files and replace aliases with their respective literal runtime suffixes.
 * @evidence contracts/testing.md#independent-expectations allowJs and preserve-JSX output contracts define .js, .mjs, .cjs and .jsx independently of the paths predictor.
 * @evidence contracts/testing.md#distinguishing-cases Extensionless targets across all four source kinds distinguish blind .js prediction; emitted references and target publication are both checked.
 * @evidence contracts/testing.md#execution-ownership This named test_paths_rewrites_allow_js_extensionless_targets_to_emitted_extensions entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native rewriting must agree with the compiler emit filenames for JavaScript-family inputs.
 * @evidence contracts/e2e.md#shared-execution One allowJs/preserve-JSX project shares its host across all four target kinds; this compiler option context differs from typed NodeNext and JSON consumers. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Real emit must produce JS/MJS/CJS/JSX target files and replace aliases with their respective literal runtime suffixes. All original assertions remain in this named entry. TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals owns eligible syntax, adjacent ordinary literals and lexical require controls in the Go unit population; these emit assertions retain serializer and copied-output responsibility.
 */
export function test_paths_rewrites_allow_js_extensionless_targets_to_emitted_extensions() {
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
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
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
}

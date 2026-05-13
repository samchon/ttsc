import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestFirstPartyPlugins } from "../../internal/TestFirstPartyPlugins";

/**
 * Verifies ttsc first-party plugins: shared transform host works when paths is
 * first.
 *
 * This first-party plugin scenario stays in the compiler package because it
 * verifies shared host behavior across package boundaries.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads one or more first-party plugin
 *    descriptors.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_first_party_plugins_shared_transform_host_works_when_paths_is_first =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          declaration: true,
          strict: true,
          paths: {
            "@lib/*": ["./src/modules/*"],
          },
          outDir: "dist",
          rootDir: "src",
          plugins: [
            { transform: "@ttsc/paths" },
            { transform: "@ttsc/banner", text: "paths first" },
            {
              transform: "@ttsc/strip",
              calls: ["console.log"],
              statements: ["debugger"],
            },
          ],
        },
        include: ["src"],
      }),
      "src/modules/message.ts": `export const message = "ok";\n`,
      "src/main.ts": [
        `import { message } from "@lib/message";`,
        `console.log("drop");`,
        `debugger;`,
        `export const value = message;`,
        ``,
      ].join("\n"),
    });
    TestFirstPartyPlugins.seedPackages(root, ["banner", "paths", "strip"]);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestFirstPartyPlugins.goPath(),
          TTSC_CACHE_DIR: fs.mkdtempSync(
            path.join(os.tmpdir(), "ttsc-first-party-paths-first-"),
          ),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    TestFirstPartyPlugins.assertSingleBanner(js, "paths first");
    TestFirstPartyPlugins.assertSingleBanner(dts, "paths first");
    assert.match(js, /require\("\.\/modules\/message\.js"\)/);
    assert.doesNotMatch(js, /@lib\/message|console\.log|\bdebugger\b/);
  };

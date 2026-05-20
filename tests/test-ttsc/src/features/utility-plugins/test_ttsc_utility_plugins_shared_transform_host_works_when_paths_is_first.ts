import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

/**
 * Verifies ttsc utility plugins: shared transform host works when paths is
 * first.
 *
 * Locks the descriptor-order invariant: `@ttsc/paths` is a linked contributor
 * and `@ttsc/banner`/`@ttsc/strip` own the shared transform host. Placing
 * `@ttsc/paths` first in the descriptor list must not change host selection or
 * cause a second native host to be spawned.
 *
 * 1. Configure plugins with `paths` listed before `banner` and `strip`.
 * 2. Run `ttsc --emit`.
 * 3. Assert one linked host was built with 3 contributors, path aliases were
 *    rewritten, banner was prepended, and `console.log`/`debugger` were
 *    stripped.
 */
export const test_ttsc_utility_plugins_shared_transform_host_works_when_paths_is_first =
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
    TestUtilityPlugins.seedPackages(root, ["banner", "paths", "strip"]);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-utility-paths-first-"),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /building linked plugin host "linked-plugin-host"/,
    );
    assert.match(result.stderr, /\+ 3 contributor\(s\):/);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    TestUtilityPlugins.assertSingleBanner(js, "paths first");
    TestUtilityPlugins.assertSingleBanner(dts, "paths first");
    assert.match(js, /require\("\.\/modules\/message\.js"\)/);
    assert.doesNotMatch(js, /@lib\/message|console\.log|\bdebugger\b/);
  };

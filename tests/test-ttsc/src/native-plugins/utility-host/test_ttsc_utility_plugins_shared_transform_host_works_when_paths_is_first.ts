import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { SHARED_GO_BUILD_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsc utility plugins: shared transform host works when paths is
 * first.
 *
 * Locks the descriptor-order invariant: `@ttsc/paths` is a linked contributor
 * and `@ttsc/banner`/`@ttsc/strip` own the shared transform host. Placing
 * `@ttsc/paths` first in the descriptor list must not change host selection or
 * cause a second native host to be spawned.
 *
 * 1. Configure plugins with `paths` listed before `banner` and `strip`;
 *    `banner`/`strip` read their `*.config.json` files.
 * 2. Run `ttsc --emit`.
 * 3. Assert one linked host was built with 3 contributors, path aliases were
 *    rewritten, banner was prepended, and `console.log`/`debugger` were
 *    stripped.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual cold linked-host build must report three contributors, emit exactly one banner in JS and declarations, rewrite imports and remove console/debugger.
 * @evidence contracts/testing.md#independent-expectations Literal paths-first banner and exact contributor count distinguish one aggregate host from descriptor-order-dependent ownership.
 * @evidence contracts/testing.md#distinguishing-cases Owns paths as the first descriptor, banner/strip config discovery, linked host assembly and JS/declaration composition.
 * @evidence contracts/testing.md#execution-ownership The matching named utility-host export owns one cold native pass in the shared Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary The loader must select one linked host and statically compile all three contributors regardless of descriptor order; semantic units cannot prove that assembled binary ran.
 * @evidence contracts/e2e.md#shared-execution Compiler objects are shared, but this case retains a fresh plugin cache because its original build diagnostics observe cold host publication.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh source/config/output and independently cold plugin cache prevent a warm binary masking host selection; shared Go objects do not bypass the asserted link build.
 * @evidence contracts/e2e.md#preserved-coverage Every original cold-build diagnostic, contributor count, single-banner JS/declaration check, rewritten import and removed-side-effect assertion remains.
 */
export function test_ttsc_utility_plugins_shared_transform_host_works_when_paths_is_first(): void {
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
            { transform: "@ttsc/banner" },
            { transform: "@ttsc/strip" },
          ],
        },
        include: ["src"],
      }),
      "banner.config.json": JSON.stringify({ text: "paths first" }),
      "strip.config.json": JSON.stringify({
        calls: ["console.log"],
        statements: ["debugger"],
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
          TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
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
  }

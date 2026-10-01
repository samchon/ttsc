import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../../../internal/banner/internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/banner/internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: banner preserves executable shebang.
 *
 * CLI entry-points use a `#!/usr/bin/env node` shebang on the very first line
 * of the emitted JS so the OS can execute the file directly. The banner
 * transform must keep that shebang as line 1 (not push it below the banner
 * block), otherwise the file is not directly executable. This test locks that
 * ordering contract.
 *
 * 1. Create a project whose source file starts with `#!/usr/bin/env node`, and
 *    configure the banner plugin with a `banner.config.cjs` file referenced via
 *    `configFile` in the tsconfig plugin entry.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert the emitted `.js` starts with the shebang line, and the banner block
 *    appears exactly once after it.
 *
 * @evidence contracts/testing.md#behavioral-verification Emitted JS must start with the original #!/usr/bin/env node line and contain one cli banner block.
 * @evidence contracts/testing.md#independent-expectations Executable shebang placement requires the first line; config text establishes the banner independently.
 * @evidence contracts/testing.md#distinguishing-cases Both interpreter directive and banner must survive; placing the banner ahead of the directive fails.
 * @evidence contracts/testing.md#execution-ownership This case_banner_preserves_executable_shebang scene is called by test_banner_native_boundary_batch through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native preamble insertion and emit serialization must preserve executable entry layout.
 * @evidence contracts/e2e.md#shared-execution A source with an interpreter directive requires its own emit input; one compile checks the directive and preamble together. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Emitted JS must start with the original #!/usr/bin/env node line and contain one cli banner block. All original assertions remain in this scene of the native boundary batch. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function case_banner_preserves_executable_shebang() {
  const root = TestProject.commonJsProject(
    {
      "banner.config.cjs": `module.exports = { text: "cli banner" };\n`,
      "src/main.ts": `#!/usr/bin/env node\nexport const value = "cli";\nconsole.log(value);\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/banner",
            configFile: "banner.config.cjs",
          },
        ],
      },
    },
  );
  TestBanner.seedPackage(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestBanner.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.equal(js.startsWith("#!/usr/bin/env node\n"), true, js);
  TestBanner.assertSingleBanner(js, "cli banner");
}

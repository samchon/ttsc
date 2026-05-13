import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: banner preserves executable shebang.
 *
 * This banner feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/banner as a project plugin.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_banner_preserves_executable_shebang = () => {
  const root = TestProject.commonJsProject(
    {
      "src/main.ts": `#!/usr/bin/env node\nexport const value = "cli";\nconsole.log(value);\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/banner",
            text: "cli banner",
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
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-banner-shebang-"),
        ),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.equal(js.startsWith("#!/usr/bin/env node\n"), true, js);
  TestBanner.assertSingleBanner(js, "cli banner");
};

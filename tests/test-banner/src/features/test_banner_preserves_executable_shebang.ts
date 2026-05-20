import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

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
 *    configure the banner plugin with a custom text via tsconfig.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert the emitted `.js` starts with the shebang line, and the banner block
 *    appears exactly once after it.
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-banner-shebang-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.equal(js.startsWith("#!/usr/bin/env node\n"), true, js);
  TestBanner.assertSingleBanner(js, "cli banner");
};

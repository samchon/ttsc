import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: auto-discovered banner fails when no config
 * file exists.
 *
 * The auto-discovery path in the banner plugin requires a `banner.config.*`
 * file to be present in the project root. Without it the plugin must fail with
 * a clear diagnostic naming the expected file glob, so users know exactly what
 * to create — a silent success or a cryptic Go panic would be worse.
 *
 * 1. Create a CommonJS project whose `package.json` lists `@ttsc/banner` as a
 *    dependency (triggers auto-discovery), but omit any `banner.config.*`
 *    file.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert non-zero exit and a stderr message referencing the config file glob.
 */
export const test_banner_auto_discovered_config_requires_banner_config_file =
  () => {
    const root = TestProject.commonJsProject({
      "src/main.ts": `export const value = "banner";\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@ttsc/banner": "*" } }),
    );
    TestBanner.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestBanner.goPath(),
          TTSC_CACHE_DIR: TestProject.tmpdir(
            "ttsc-auto-banner-missing-config-",
          ),
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /banner\.config\.\{js,cjs,mjs,ts,mts,cts\}/);
  };

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: first-party aggregate requires package identity.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_first_party_aggregate_requires_package_identity =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
        "plugins/fake-banner.cjs": `
        module.exports = {
          name: "@ttsc/banner",
          source: require("node:path").resolve(__dirname, "..", "fake-banner"),
          stage: "transform",
        };
      `,
        "plugins/fake-strip.cjs": `
        module.exports = {
          name: "@ttsc/strip",
          source: require("node:path").resolve(__dirname, "..", "fake-strip"),
          stage: "transform",
        };
      `,
        "fake-banner/go.mod": "module example.com/fakebanner\n\ngo 1.26\n",
        "fake-banner/main.go": "package main\n\nfunc main() {}\n",
        "fake-strip/go.mod": "module example.com/fakestrip\n\ngo 1.26\n",
        "fake-strip/main.go": "package main\n\nfunc main() {}\n",
      },
      {
        compilerOptions: {
          plugins: [
            { transform: "./plugins/fake-banner.cjs" },
            { transform: "./plugins/fake-strip.cjs" },
          ],
        },
      },
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-utility-fake-first-party-"),
        ),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /multiple compiler native backends cannot share one emit pass/,
    );
  };

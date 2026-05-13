import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestFirstPartyPlugins } from "../../internal/TestFirstPartyPlugins";

/**
 * Verifies ttsc first-party plugins: first-party aggregate requires package
 * identity.
 *
 * This first-party plugin scenario stays in the compiler package because it
 * verifies shared host behavior across package boundaries.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads one or more first-party plugin
 *    descriptors.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_first_party_plugins_aggregate_requires_package_identity =
  () => {
    const root = TestProject.commonJsProject(
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
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestFirstPartyPlugins.goPath(),
          TTSC_CACHE_DIR: fs.mkdtempSync(
            path.join(os.tmpdir(), "ttsc-first-party-fake-"),
          ),
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /multiple compiler native backends cannot share one emit pass/,
    );
  };

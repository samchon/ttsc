import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsc transform plugins: fake names do not bypass shared-host errors.
 *
 * Locks the generic host-selection rule. Plugin names are labels only; naming
 * an executable plugin after a package that happens to ship in this repo must
 * not grant it linked-host behavior or any other special treatment.
 *
 * 1. Two executable transform descriptors use names that look like package IDs.
 * 2. Run ttsc with both descriptors in one emit pass.
 * 3. Assert the normal multiple-native-backends error is reported.
 */
export const test_ttsc_transform_plugins_fake_names_do_not_bypass_shared_host_error =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
        "plugins/fake-banner.cjs": `
        module.exports = (context) => ({
          name: "@ttsc/banner",
          source: require("node:path").resolve(context.dirname, "..", "fake-banner"),
          stage: "transform",
        });
      `,
        "plugins/fake-strip.cjs": `
        module.exports = (context) => ({
          name: "@ttsc/strip",
          source: require("node:path").resolve(context.dirname, "..", "fake-strip"),
          stage: "transform",
        });
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
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /multiple compiler native backends cannot share one emit pass/,
    );
  };

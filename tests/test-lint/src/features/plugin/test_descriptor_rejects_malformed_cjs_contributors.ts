import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies isolated CJS evaluation preserves contributor validation failures.
 *
 * 1. Reject a scalar contributor instead of silently omitting its namespace.
 * 2. Reject an object without a source path at the declaring config.
 * 3. Reject a string specifier whose loaded module has no plugin source.
 */
export const test_descriptor_rejects_malformed_cjs_contributors = (): void => {
  for (const [name, pluginValue, moduleBody] of [
    ["scalar", "42", undefined],
    ["missing-source", "{}", undefined],
    ["malformed-module", '"../bad-contributor.cjs"', "module.exports = {};"],
  ] as const) {
    const project = createLintProject({
      name: `malformed-cjs-contributor-${name}`,
      source: "export const value = 1;\n",
      pluginConfig: { configFile: "./configs/lint.config.cjs" },
    });
    try {
      fs.mkdirSync(path.join(project.tmpdir, "configs"), { recursive: true });
      fs.writeFileSync(
        path.join(project.tmpdir, "configs", "lint.config.cjs"),
        `module.exports = { plugins: { demo: ${pluginValue} } };\n`,
        "utf8",
      );
      if (moduleBody !== undefined) {
        fs.writeFileSync(
          path.join(project.tmpdir, "bad-contributor.cjs"),
          `${moduleBody}\n`,
          "utf8",
        );
      }
      assert.throws(
        () => loadContributors(project.tmpdir),
        /contributor "demo".*source/i,
      );
    } finally {
      project.cleanup();
    }
  }
};

function loadContributors(projectRoot: string): void {
  const factory = TestLintPlugin.loadFactory();
  factory({
    ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    cwd: projectRoot,
    pluginConfigDir: projectRoot,
    projectRoot,
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
}

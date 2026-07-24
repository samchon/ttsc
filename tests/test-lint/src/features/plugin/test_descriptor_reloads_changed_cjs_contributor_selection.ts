import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies repeated descriptor resolution observes changed CJS contributors.
 *
 * CLI watch reloads execution in the same Node process. Calling `require()` on
 * the same lint config path would otherwise retain the first module export and
 * rebuild the wrong contributor binary after a config edit.
 *
 * 1. Resolve contributor A through a sibling helper outside the CJS config
 *    directory.
 * 2. Change only the helper to select contributor B.
 * 3. Resolve again in-process and require the fresh contributor source.
 * 4. Select a contributor through a config-relative module specifier and preserve
 *    the executable-config contract that strings load plugin modules.
 */
export const test_descriptor_reloads_changed_cjs_contributor_selection =
  (): void => {
    const project = createLintProject({
      name: "contributor-selection-cjs-reload",
      source: "export const value = 1;\n",
      pluginConfig: { configFile: "./configs/lint.config.cjs" },
    });
    try {
      const alpha = createContributorSource(project.tmpdir, "alpha");
      const beta = createContributorSource(project.tmpdir, "beta");
      writeConfig(project.tmpdir);
      writeSelection(project.tmpdir, "alpha", alpha);
      assert.deepEqual(loadContributors(project.tmpdir), [
        { name: "alpha", source: alpha },
      ]);

      writeSelection(project.tmpdir, "beta", beta);
      assert.deepEqual(loadContributors(project.tmpdir), [
        { name: "beta", source: beta },
      ]);

      writeSpecifierSelection(project.tmpdir, alpha);
      assert.deepEqual(loadContributors(project.tmpdir), [
        { name: "demo", source: alpha },
      ]);
    } finally {
      project.cleanup();
    }
  };

function createContributorSource(root: string, name: string): string {
  const source = path.join(root, "contributors", name);
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "rule.go"), "package contributor\n");
  return source;
}

function writeConfig(root: string): void {
  fs.mkdirSync(path.join(root, "configs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "configs", "lint.config.cjs"),
    'module.exports = require("../selection.cjs");\n',
    "utf8",
  );
}

function writeSelection(root: string, namespace: string, source: string): void {
  fs.writeFileSync(
    path.join(root, "selection.cjs"),
    `module.exports = ${JSON.stringify({
      plugins: { [namespace]: { source } },
    })};\n`,
    "utf8",
  );
}

function writeSpecifierSelection(root: string, source: string): void {
  fs.writeFileSync(
    path.join(root, "contributor.cjs"),
    `module.exports = ${JSON.stringify({ source })};\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "selection.cjs"),
    `module.exports = { plugins: { demo: "../contributor.cjs" } };\n`,
    "utf8",
  );
}

function loadContributors(
  projectRoot: string,
): Array<{ name: string; source: string }> {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory({
    ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    cwd: projectRoot,
    pluginConfigDir: projectRoot,
    projectRoot,
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
  return descriptor.contributors ?? [];
}

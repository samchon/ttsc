import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../../internal/lint/internal/TestLintPlugin";
import { createLintProject } from "../../../internal/lint/internal/config-file";

/**
 * Verifies repeated descriptor resolution observes changed CJS contributors.
 *
 * CLI watch reloads execution in the same Node process. Calling `require()` on
 * the same lint config path would otherwise retain the first module export and
 * rebuild the wrong contributor binary after a config edit.
 *
 * 1. Resolve contributor A through a logging CJS config and sibling helper outside
 *    its directory, without mixing stdout into the result payload.
 * 2. Change only the helper to select contributor B.
 * 3. Resolve again in-process and require the fresh contributor source.
 * 4. Select contributor A through an installed-package string specifier and
 *    preserve the executable-config contract that strings load plugin modules.
 * 5. Change only that package module and require contributor B, proving package
 *    changes invalidate contributor selection. This case does not inspect watch inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Repeated emitted-factory calls observe alpha then beta after editing only the sibling CJS helper, then demo source alpha followed by beta after editing only its required package module.
 * @evidence contracts/testing.md#independent-expectations Independently authored selection files name literal namespaces and explicit source paths; all four exact contributor arrays must match those successive inputs.
 * @evidence contracts/testing.md#distinguishing-cases Helper-only and installed-package-only edits leave the parent config path unchanged, distinguishing stale require/cache results from correct dependency invalidation.
 * @evidence contracts/testing.md#execution-ownership The named entry makes four actual descriptor resolutions in one Node suite lifetime; direct dependency-digest units do not replace actual require-cache invalidation.
 * @evidence contracts/e2e.md#necessary-boundary Real CJS helper and package require caching must not hide changed registration; synthetic dependency records cannot prove the module evaluator reads the updated export.
 * @evidence contracts/e2e.md#shared-execution One project and two contributor source directories serve all four resolutions. Each changed helper/package input requires reevaluation, but no source is compiled and no native host is launched.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The same config path is intentionally retained during each dependency-only mutation so a stale module result is observable; the owned project is removed in finally. This transition must not reuse a cached completed descriptor.
 * @evidence contracts/e2e.md#preserved-coverage Original four exact contributor arrays, sibling helper outside configs, logging config and string package-specifier reload remain executable; this case asserts selection freshness, not absence from a watch-input list.
 */
export function test_descriptor_reloads_changed_cjs_contributor_selection(): void {
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
      writeSpecifierPackage(project.tmpdir, beta);
      assert.deepEqual(loadContributors(project.tmpdir), [
        { name: "demo", source: beta },
      ]);
    } finally {
      project.cleanup();
    }
  }

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
    'console.log("loading CJS lint config");\nmodule.exports = require("../selection.cjs");\n',
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
  writeSpecifierPackage(root, source);
  fs.writeFileSync(
    path.join(root, "selection.cjs"),
    `module.exports = { plugins: { demo: "demo-contributor" } };\n`,
    "utf8",
  );
}

function writeSpecifierPackage(root: string, source: string): void {
  const directory = path.join(
    root,
    "configs",
    "node_modules",
    "demo-contributor",
  );
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "package.json"),
    '{"main":"index.cjs"}\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(directory, "index.cjs"),
    `module.exports = ${JSON.stringify({ source })};\n`,
    "utf8",
  );
}

function loadContributors(
  projectRoot: string,
): Array<{ name: string; source: string }> {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory({
    // The fixture declares its config through the tsconfig plugin entry, so a
    // hand-built context has to carry the same entry. Without it discovery
    // walks upward from the project root and never sees a config that lives
    // in a subdirectory, and the descriptor reports no contributors at all.
    ...TestLintPlugin.factoryContext({
      configFile: "./configs/lint.config.cjs",
      transform: "@ttsc/lint",
    }),
    cwd: projectRoot,
    pluginConfigDir: projectRoot,
    projectRoot,
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
  return descriptor.contributors ?? [];
}

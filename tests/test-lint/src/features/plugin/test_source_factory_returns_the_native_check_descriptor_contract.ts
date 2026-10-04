import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import createTtscPlugin from "../../../../../packages/lint/src/createTtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";
import { TestLintPlugin } from "../internal/TestLintPlugin";

/**
 * Verifies the source factory returns the native check descriptor contract.
 *
 * An explicit empty JSON config keeps this call on the plain-data path. The
 * result's stage and capabilities tell the host which check and project-input
 * responsibilities the descriptor owns. This source call cannot establish the
 * emitted package export or the host's actual consumption of those fields.
 *
 * 1. Write an empty rules config in one disposable root.
 * 2. Call the actual default source factory with that explicit config.
 * 3. Require its callable export, name, stage and two host capability literals.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual default createTtscPlugin export is callable and its JSON-only invocation returns name @ttsc/lint, stage check, reportsTypeScriptDiagnostics true and capabilities.projectInputs true. Wrong descriptor metadata or a missing capability fails its exact assertion.
 * @evidence contracts/testing.md#independent-expectations The supported lint descriptor contract independently requires a callable factory, the @ttsc/lint check stage, TypeScript diagnostic ownership and project-input observation. These five literal expectations are not generated from the returned descriptor or read from source text.
 * @evidence contracts/testing.md#distinguishing-cases This positive owns the five metadata values on a contributor-free JSON path. Existing entry-validation and config units own rejected inputs; built module assembly and actual native check publication remain distinct E2E connections, not outcomes certified by this call.
 * @evidence contracts/testing.md#execution-ownership This matching source-unit entry imports and calls the actual default source factory over an explicit private JSON fixture removed in finally. It evaluates no executable config, builds no native artifact, installs no consumer and starts no product host; it does not load lib/index.js.
 */
export function test_source_factory_returns_the_native_check_descriptor_contract(): void {
  const root = TestProject.tmpdir("ttsc-lint-source-descriptor-unit-");
  try {
    fs.writeFileSync(path.join(root, "lint.config.json"), '{"rules":{}}\n');
    assert.equal(typeof createTtscPlugin, "function");
    const descriptor = createTtscPlugin({
      ...TestLintPlugin.factoryContext({
        transform: "@ttsc/lint",
        configFile: "./lint.config.json",
      }),
      cwd: root,
      pluginConfigDir: root,
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    });
    assert.equal(descriptor.name, "@ttsc/lint");
    assert.equal(descriptor.stage, "check");
    assert.equal(descriptor.reportsTypeScriptDiagnostics, true);
    assert.equal(descriptor.capabilities?.projectInputs, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

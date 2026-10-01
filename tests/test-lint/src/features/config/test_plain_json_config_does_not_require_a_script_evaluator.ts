import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";
import { TestLintPlugin } from "../internal/TestLintPlugin";

/**
 * Verifies plain JSON configuration can resolve without a script evaluator.
 *
 * The fixture contains neither plugins nor extends. Its deliberately nonexistent
 * launcher input makes an unnecessary attempt to evaluate user code observable.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored factory resolves an explicit JSON rules object with a nonexistent evaluator input and returns its descriptor without contributors, proving the plain-data path does not launch a script evaluator.
 * @evidence contracts/testing.md#independent-expectations A JSON object with only a rules map can declare no contributor and executes no user code; the independently authored missing launcher must therefore be irrelevant to descriptor resolution.
 * @evidence contracts/testing.md#distinguishing-cases The plain no-plugins/no-extends object owns the evaluator-free decision. The native language boundary separately owns an extends chain containing executable configs, and contributor protocol E2E owns actual module evaluation.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls authored createTtscPlugin through the direct source helper over a private JSON fixture. The invalid launcher is an explicit input, not a patched spawn or fake evaluator; the passing path installs nothing, starts no child and builds no native artifact.
 */
export function test_plain_json_config_does_not_require_a_script_evaluator(): void {
  const root = TestProject.tmpdir("ttsc-lint-plain-json-unit-");
  const previous = process.env.TTSC_TTSX_BINARY;
  const missingLauncher = path.join(root, "missing-evaluator");
  process.env.TTSC_TTSX_BINARY = missingLauncher;
  try {
    fs.writeFileSync(
      path.join(root, "ttsc-lint.config.json"),
      '{"rules":{"no-var":"error"}}',
    );
    const descriptor = TestLintPlugin.loadFactory()({
      ...TestLintPlugin.factoryContext({
        transform: "@ttsc/lint",
        configFile: "./ttsc-lint.config.json",
      }),
      binary: missingLauncher,
      cwd: root,
      pluginConfigDir: root,
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    });
    assert.equal(descriptor.name, "@ttsc/lint");
    assert.deepEqual(descriptor.contributors ?? [], []);
  } finally {
    if (previous === undefined) delete process.env.TTSC_TTSX_BINARY;
    else process.env.TTSC_TTSX_BINARY = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../../internal/lint/internal/TestLintPlugin";
import { createLintProject } from "../../../internal/lint/internal/config-file";

/**
 * Verifies a CJS lint config rejects distinct contributor namespaces that
 * normalize to the same Go subpackage name.
 *
 * The descriptor factory used to keep the first normalized name and silently
 * drop every later contributor. This config-evaluation boundary owns the
 * user-facing diagnostic, so it must name all colliding namespaces and the
 * shared Go name before a native host build can hide the cause.
 *
 * 1. Materialize one CJS config carrying distinct a-b and a_b contributors.
 * 2. Invoke the real built lint descriptor factory and assert its diagnostic.
 * 3. Check both original namespace names, the shared Go name and config path.
 *
 * Collision permutations, exact repetition, independent names and empty input
 * have authored direct normalization-unit owners without evaluator processes; current selection/runtime survival must be checked separately before further removal.
 *
 * @evidence contracts/testing.md#behavioral-verification The built descriptor evaluates a real CJS config with a-b and a_b contributors, and the thrown diagnostic must name the config, both namespaces and shared Go name.
 * @evidence contracts/testing.md#independent-expectations Distinct user namespaces cannot map to one Go subpackage; literal original spellings and a_b follow the supported hyphen-to-underscore naming contract.
 * @evidence contracts/testing.md#distinguishing-cases This surviving CJS case owns one distinct-name collision across evaluator transport. Permutations, three-way collisions, exact repetition, valid independent names and empty entries are authored in tests/test-lint/src/features/plugin/test_contributor_namespace_normalization_preserves_every_registration.ts, whose direct normalizeContributors body compares independent name/source/message literals without real evaluator transport.
 * @evidence contracts/testing.md#execution-ownership The named E2E entry loads the built factory and real isolated config evaluator; portable normalization decisions execute in the separate source-unit population.
 * @evidence contracts/e2e.md#necessary-boundary CJS evaluation must carry original namespace spellings and resolved source paths into the descriptor resolver and propagate its collision error; direct normalization calls cannot verify that serialization and error connection.
 * @evidence contracts/e2e.md#shared-execution This named boundary uses one CJS fixture/factory call through the isolated evaluator/selected compiler route; parent call count does not certify fixed inner children or Program totals. The direct normalization matrix needs no evaluator, while the TypeScript case separately preserves its format/loader connection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture owns two contributor source directories and a CJS config, none of which mutates during evaluation. Its project cleanup is attempted in finally; an original helper failure is retained alongside cleanup failure. Workspace artifact/cache paths do not certify image identity or substitute a previous evaluator result; sync return is not arbitrary descendant join.
 * @evidence contracts/e2e.md#preserved-coverage The original first CJS collision retains its path/name/shared-Go diagnostic assertions. The exact direct normalization-unit body retains reverse-order equality, three spellings, first-source exact repetition, independent names, singleton/empty and sorted two-group diagnostics. Its source selection/body existence is not current runtime survival, and no real evaluator connection is certified by that matrix.
 */
export function test_descriptor_rejects_colliding_contributor_namespaces_from_cjs_config(): void {
  assertCollision(["a-b", "a_b"], "a_b");
}

function assertCollision(namespaces: string[], goName: string): string {
  const project = createLintProject({
    name: `contributor-namespace-cjs-${goName}`,
    source: "export const value = 1;\n",
    pluginConfig: { configFile: "./lint.config.cjs" },
  });
  const failures: unknown[] = [];
  try {
    writeCjsConfig(
      project.tmpdir,
      namespaces.map((namespace, index) => [
        namespace,
        createContributorSource(project.tmpdir, `source-${index}`),
      ]),
    );
    let message = "";
    assert.throws(
      () => loadContributors(project.tmpdir),
      (error) => {
        assert.ok(error instanceof Error);
        message = error.message;
        assert.match(error.message, /lint\.config\.cjs/);
        assert.match(error.message, new RegExp(JSON.stringify(goName)));
        for (const namespace of namespaces) {
          assert.match(error.message, new RegExp(JSON.stringify(namespace)));
        }
        return true;
      },
    );
    const marker = " contributor namespaces collide";
    const markerIndex = message.indexOf(marker);
    assert.notEqual(markerIndex, -1);
    return message.slice(markerIndex);
  } catch (error) {
    failures.push(error);
    throw error;
  } finally {
    try {
      project.cleanup();
    } catch (error) {
      failures.push(error);
      throw new AggregateError(failures, "Contributor collision observation or owned cleanup failed");
    }
  }
}

function createContributorSource(root: string, name: string): string {
  const directory = path.join(root, "contributors", name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "rule.go"), "package contributor\n");
  return directory;
}

function writeCjsConfig(
  root: string,
  entries: Array<[namespace: string, source: string]>,
): void {
  const plugins = Object.fromEntries(
    entries.map(([namespace, source]) => [namespace, { source }]),
  );
  writeCjsConfigValue(root, { plugins });
}

function writeCjsConfigValue(root: string, value: unknown): void {
  fs.writeFileSync(
    path.join(root, "lint.config.cjs"),
    `module.exports = ${JSON.stringify(value, null, 2)};\n`,
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

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../../internal/lint/internal/TestLintPlugin";
import { createLintProject } from "../../../internal/lint/internal/config-file";

/**
 * Verifies helper-only contributor changes are observed for MJS and TypeScript.
 *
 * 1. Resolve contributor A through a logging MJS config and sibling MJS helper
 *    without mixing stdout into the result payload.
 * 2. Change only that helper and resolve contributor B from the same entry.
 * 3. Repeat the identical transition through a TypeScript config/helper pair.
 *
 * @evidence contracts/testing.md#behavioral-verification Repeated emitted-factory resolution changes alpha to beta after only the imported sibling helper changes, for both MJS and TypeScript config/helper pairs.
 * @evidence contracts/testing.md#independent-expectations The written helper exports independently name alpha or beta with an explicit corresponding source path; each full literal contributor array is checked after its own input state.
 * @evidence contracts/testing.md#distinguishing-cases Both native ESM and ttsx TypeScript module routes retain their entry path while the transitive helper changes; CJS and string-package transitions have a separate owner.
 * @evidence contracts/testing.md#execution-ownership The named entry calls the workspace-built factory before and after helper-only edits in MJS and TypeScript inputs through the actual selected evaluator/compiler route. Direct dependency records do not establish these module reads; neither lane runs CLI watch or a native lint rule host.
 * @evidence contracts/e2e.md#necessary-boundary Real ESM and ttsx transitive module evaluation must observe edits despite stable config paths, a connection direct config-result or digest comparisons cannot establish.
 * @evidence contracts/e2e.md#shared-execution Each format uses one project and two source-only contributor directories for its before/after factory calls, sharing selected built artifacts. Actual evaluator children, compiler Programs and cache outcomes are not counted by the four parent calls; no contributor Go build or native lint rule host is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Format projects are separate while each config/helper path stays stable across the intentional edit. Preparation, observation and cleanup failures retain the format identity before attempting the other lane; before-state output cannot satisfy the literal after-state array. Selected paths do not certify loaded-image identity or descendant joins.
 * @evidence contracts/e2e.md#preserved-coverage Both original MJS/TypeScript alpha-to-beta transitions, sibling imports and four exact arrays remain, and one format failure no longer hides the independent lane. Other module formats are outside this declaration; consolidated registration, survivor execution and measurement remain unverified.
 */
export function test_descriptor_reloads_changed_esm_and_typescript_contributor_selection(): void {
    const failures: unknown[] = [];
    for (const extension of ["mjs", "ts"] as const) {
      let project: ReturnType<typeof createLintProject> | undefined;
      try {
        project = createLintProject({
          name: `contributor-selection-${extension}-reload`,
          source: "export const value = 1;\n",
          pluginConfig: {
            configFile: `./configs/lint.config.${extension}`,
          },
        });
        const alpha = createContributorSource(project.tmpdir, "alpha");
        const beta = createContributorSource(project.tmpdir, "beta");
        writeModuleConfig(project.tmpdir, extension);
        writeModuleSelection(project.tmpdir, extension, "alpha", alpha);
        assert.deepEqual(loadContributors(project.tmpdir, extension), [
          { name: "alpha", source: alpha },
        ]);

        writeModuleSelection(project.tmpdir, extension, "beta", beta);
        assert.deepEqual(loadContributors(project.tmpdir, extension), [
          { name: "beta", source: beta },
        ]);
      } catch (error) {
        failures.push(new AggregateError([error], `${extension} contributor reload observation failed`));
      } finally {
        try {
          project?.cleanup();
        } catch (error) {
          failures.push(new AggregateError([error], `${extension} contributor reload owned cleanup failed`));
        }
      }
    }
    if (failures.length !== 0) {
      throw new AggregateError(failures, "Contributor reload format observations or owned cleanup failed");
    }
  }

function createContributorSource(root: string, name: string): string {
  const source = path.join(root, "contributors", name);
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "rule.go"), "package contributor\n");
  return source;
}

function writeModuleConfig(root: string, extension: "mjs" | "ts"): void {
  const directory = path.join(root, "configs");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, `lint.config.${extension}`),
    `import plugins from "../selection.${extension}";
console.log("loading ${extension} lint config");
export default { plugins };
`,
    "utf8",
  );
}

function writeModuleSelection(
  root: string,
  extension: "mjs" | "ts",
  namespace: string,
  source: string,
): void {
  fs.writeFileSync(
    path.join(root, `selection.${extension}`),
    `export default ${JSON.stringify({
      [namespace]: { source },
    })};
`,
    "utf8",
  );
}

function loadContributors(
  projectRoot: string,
  extension: string,
): Array<{ name: string; source: string }> {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory({
    // The fixture declares its config through the tsconfig plugin entry, so a
    // hand-built context has to carry the same entry. Without it discovery
    // walks upward from the project root and never sees a config that lives in
    // a subdirectory, and the descriptor reports no contributors at all.
    ...TestLintPlugin.factoryContext({
      configFile: `./configs/lint.config.${extension}`,
      transform: "@ttsc/lint",
    }),
    cwd: projectRoot,
    pluginConfigDir: projectRoot,
    projectRoot,
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
  return descriptor.contributors ?? [];
}

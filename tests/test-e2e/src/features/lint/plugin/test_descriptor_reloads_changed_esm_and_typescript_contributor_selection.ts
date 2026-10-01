import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../../internal/lint/internal/TestLintPlugin";
import { createLintProject } from "../../../internal/lint/internal/config-file";

/**
 * Verifies helper-only contributor changes invalidate every module format.
 *
 * 1. Resolve contributor A through a logging MJS config and sibling MJS helper
 *    without mixing stdout into the result payload.
 * 2. Change only that helper and resolve contributor B from the same entry.
 * 3. Repeat the identical transition through a TypeScript config/helper pair.
 *
 * @evidence contracts/testing.md#behavioral-verification Repeated emitted-factory resolution changes alpha to beta after only the imported sibling helper changes, for both MJS and TypeScript config/helper pairs.
 * @evidence contracts/testing.md#independent-expectations The written helper exports independently name alpha or beta with an explicit corresponding source path; each full literal contributor array is checked after its own input state.
 * @evidence contracts/testing.md#distinguishing-cases Both native ESM and ttsx TypeScript module routes retain their entry path while the transitive helper changes; CJS and string-package transitions have a separate owner.
 * @evidence contracts/testing.md#execution-ownership The named entry runs both actual module evaluators and their before/after descriptor calls; source dependency selection tests do not claim to execute ESM or TypeScript module caching.
 * @evidence contracts/e2e.md#necessary-boundary Real ESM and ttsx transitive module evaluation must observe edits despite stable config paths, a connection direct config-result or digest comparisons cannot establish.
 * @evidence contracts/e2e.md#shared-execution Each format uses one project and the same two source directories for its before/after calls. Distinct format loaders and changed helper inputs require reevaluation; no contributor Go build or native host is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each format has a fresh project, but its config/helper paths remain stable across the intentional helper mutation; cleanup is in finally and successful before-state output is never reused after the edit.
 * @evidence contracts/e2e.md#preserved-coverage Both original MJS and TypeScript alpha-to-beta transitions, sibling relative imports and four exact contributor arrays remain executable.
 */
export function test_descriptor_reloads_changed_esm_and_typescript_contributor_selection(): void {
    for (const extension of ["mjs", "ts"] as const) {
      const project = createLintProject({
        name: `contributor-selection-${extension}-reload`,
        source: "export const value = 1;\n",
        pluginConfig: {
          configFile: `./configs/lint.config.${extension}`,
        },
      });
      try {
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
      } finally {
        project.cleanup();
      }
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

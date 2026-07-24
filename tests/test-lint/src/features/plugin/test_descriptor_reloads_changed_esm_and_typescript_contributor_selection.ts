import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies helper-only contributor changes invalidate every module format.
 *
 * 1. Resolve contributor A through a logging MJS config and sibling MJS helper
 *    without mixing stdout into the result payload.
 * 2. Change only that helper and resolve contributor B from the same entry.
 * 3. Repeat the identical transition through a TypeScript config/helper pair.
 */
export const test_descriptor_reloads_changed_esm_and_typescript_contributor_selection =
  (): void => {
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
        assert.deepEqual(loadContributors(project.tmpdir), [
          { name: "alpha", source: alpha },
        ]);

        writeModuleSelection(project.tmpdir, extension, "beta", beta);
        assert.deepEqual(loadContributors(project.tmpdir), [
          { name: "beta", source: beta },
        ]);
      } finally {
        project.cleanup();
      }
    }
  };

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

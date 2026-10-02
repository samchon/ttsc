import { TestProject } from "../../../../utils/src/TestProject";
import type createTtscPlugin from "../../../../../packages/lint/src/createTtscPlugin";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Verifies lint JSON discovery records candidates and stops at a selected file.
 *
 * Native descriptor input tracking must distinguish files from candidate-named
 * directories and retain absent nearer config names before an ancestor winner.
 * Plain JSON has no executable config dependency and needs no product evaluator.
 *
 * 1. Call the real lint factory for a project whose `lint.config.ts` is a
 *    directory and `lint.config.mts` is a link to a directory, with a
 *    `lint.config.json` file in the workspace two levels above.
 * 2. Assert the reported host inputs include the directory candidates, the
 *    ancestor's absent `ttsc-lint.config.cjs` name and the selected JSON, but not
 *    a file above it; then add two JSON configs in the project and assert the
 *    factory throws a multiple-config error.
 * 3. On Windows only, assert a differently-cased `Lint.Config.Json` is selected
 *    under its native spelling with a SHA-256 hash and discovery stops there.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real @ttsc/lint createTtscPlugin factory over a temporary workspace and asserts descriptor.hostInputs membership, the error for two sibling JSON configs, and (Windows only) the content hash of a case-variant config.
 * @evidence contracts/testing.md#independent-expectations The fixture authors the winner (workspace/lint.config.json) and the non-matches (a directory, a directory link) up front, and the expectations are literal paths: candidate names the walk must have recorded, a path above the winner that must be absent, and the literal error text naming `lint.config.json, ttsc-lint.config.json`.
 * @evidence contracts/testing.md#distinguishing-cases A candidate-named directory and a link to a directory must not stop discovery (they are recorded, then the walk continues to the ancestor JSON); a nearer absent candidate name is still recorded before the ancestor winner; two real JSON files in one directory are ambiguous. Executable (.js/.ts) configs and the evaluator are not exercised.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/utility; it loads the TypeScript factory through createRequire and runs discovery over TestProject.tmpdir directories holding only `{}` JSON files, directories and a directory link, with no evaluator, native build or host. The Windows case is skipped on other platforms by a process.platform check.
 */
export function test_lint_descriptor_discovers_json_candidates_without_an_evaluator(): void {
  const workspace = TestProject.tmpdir("ttsc-lint-host-inputs-");
  const project = path.join(workspace, "packages", "app");
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.join(project, "lint.config.ts"));
  const linkedDirectory = path.join(workspace, "linked-config-directory");
  fs.mkdirSync(linkedDirectory);
  fs.symlinkSync(
    linkedDirectory,
    path.join(project, "lint.config.mts"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const selected = path.join(workspace, "lint.config.json");
  fs.writeFileSync(selected, "{}\n", "utf8");

  const filename = path.join(TestProject.WORKSPACE_ROOT, "packages", "lint", "src", "createTtscPlugin.ts");
  const factory = (createRequire(import.meta.url)(filename) as { default: typeof createTtscPlugin }).default;
  const context = {
    binary: "",
    cwd: project,
    dirname: path.dirname(filename),
    filename,
    plugin: { transform: "@ttsc/lint" },
    pluginConfigDir: project,
    projectRoot: project,
    tsconfig: path.join(project, "tsconfig.json"),
  };
  const descriptor = factory(context);

  assert.ok(descriptor.hostInputs);
  assert.ok(descriptor.hostInputs.includes(selected));
  assert.ok(
    descriptor.hostInputs.includes(path.join(project, "lint.config.ts")),
  );
  assert.ok(
    descriptor.hostInputs.includes(path.join(project, "lint.config.mts")),
  );
  assert.ok(
    descriptor.hostInputs.includes(
      path.join(workspace, "packages", "ttsc-lint.config.cjs"),
    ),
  );
  assert.equal(
    descriptor.hostInputs.includes(
      path.join(path.dirname(workspace), "lint.config.json"),
    ),
    false,
  );

  fs.writeFileSync(path.join(project, "lint.config.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(project, "ttsc-lint.config.json"),
    "{}\n",
    "utf8",
  );
  assert.throws(
    () => factory(context),
    /multiple lint config files found.*lint\.config\.json, ttsc-lint\.config\.json/,
  );

  if (process.platform === "win32") {
    const caseWorkspace = TestProject.tmpdir("ttsc-lint-host-input-case-");
    const caseProject = path.join(caseWorkspace, "packages", "app");
    fs.mkdirSync(caseProject, { recursive: true });
    fs.writeFileSync(
      path.join(caseProject, "Lint.Config.Json"),
      "{}\n",
      "utf8",
    );
    const caseDescriptor = factory({
      ...context,
      cwd: caseProject,
      pluginConfigDir: caseProject,
      projectRoot: caseProject,
      tsconfig: path.join(caseProject, "tsconfig.json"),
    });
    assert.ok(caseDescriptor.hostInputHashes);
    assert.ok(caseDescriptor.hostInputs);
    const nativeSpelling = path.join(caseProject, "lint.config.json");
    assert.match(
      caseDescriptor.hostInputHashes[nativeSpelling] as string,
      /^[0-9a-f]{64}$/,
    );
    assert.equal(
      caseDescriptor.hostInputs.includes(
        path.join(caseWorkspace, "lint.config.ts"),
      ),
      false,
    );
  }

}

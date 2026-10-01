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
 * 1. Call the authored lint factory with candidate directories and ancestor JSON.
 * 2. Assert all original discovery bounds and reject conflicting nearer JSON files.
 * 3. On Windows, preserve the native-spelling content hash and ancestor stop control.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual authored createTtscPlugin and preserves the original candidate-path presence, selected ancestor stop, ambiguous JSON refusal and Windows native-spelling hash assertions.
 * @evidence contracts/testing.md#independent-expectations Explicit files and directory links establish the winner independently from discovery; literal path memberships, absent higher ancestor and duplicate-config error distinguish the expected walk.
 * @evidence contracts/testing.md#distinguishing-cases Owns ordinary and linked candidate directories, selected ancestor JSON, absent nearer names, two conflicting local JSON files and the existing Windows spelling control. Script-import resolution and retargeted executable CJS config remain in the actual evaluator boundary.
 * @evidence contracts/testing.md#execution-ownership The matching named unit export loads the authored lint factory directly with only a temporary JSON discovery filesystem; no consumer installation, native build or executable-config evaluator is needed. The Windows control is conditional on the actual filesystem as before.
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

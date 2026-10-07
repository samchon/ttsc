import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type createTtscPlugin from "../../../../../packages/lint/src/createTtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies lint JSON discovery records candidates and stops at a selected file.
 *
 * Native descriptor input tracking must distinguish files from candidate-named
 * directories and retain absent nearer config names before an ancestor winner.
 * Plain JSON has no executable config dependency and needs no product
 * evaluator.
 *
 * 1. Call the real lint factory for a project whose `lint.config.ts` is a
 *    directory and `lint.config.mts` is a link to a directory, with a
 *    `lint.config.json` file in the workspace two levels above.
 * 2. Assert the reported host inputs include the directory candidates, the
 *    ancestor's absent `ttsc-lint.config.cjs` name and the selected JSON, but
 *    not a file above it; then add two JSON configs in the project and assert
 *    the factory throws a multiple-config error.
 * 3. Contrast a differently-cased config with the filesystem's actual alias
 *    identity, then require a canonical-spelling config to stop discovery
 *    locally.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real @ttsc/lint createTtscPlugin factory over a temporary workspace and asserts descriptor.hostInputs membership, the error for two sibling JSON configs and local-versus-ancestor selection under the actual native case identity; canonical spelling must always select locally.
 * @evidence contracts/testing.md#independent-expectations Authored winner/directory/link inputs establish literal candidate paths and the multiple-config error naming lint.config.json and ttsc-lint.config.json. Native device/inode observations establish case alias identity independently of factory output; node:crypto computes SHA-256 of the authored JSON bytes independently of the descriptor's hash helper.
 * @evidence contracts/testing.md#distinguishing-cases A candidate-named directory and directory link cannot stop discovery; absent nearer candidates precede the ancestor winner and two real sibling JSON files are ambiguous. A case-variant name selects locally only when native device/inode identity proves it aliases the canonical candidate; otherwise the absent candidate must permit ancestor selection. Exact spelling then supplies an unconditional local positive control. Executable configs and the evaluator are not exercised.
 * @evidence contracts/testing.md#execution-ownership The named utility unit loads the actual TypeScript factory through createRequire and calls it over TestProject-owned JSON files, directories and a native directory link, without an evaluator, native build or product host. Both case-policy outcomes are specified, and the canonical positive runs on every platform without a skip.
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

  const filename = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "lint",
    "src",
    "createTtscPlugin.ts",
  );
  const factory = (
    createRequire(import.meta.url)(filename) as {
      default: typeof createTtscPlugin;
    }
  ).default;
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
  fs.writeFileSync(path.join(project, "ttsc-lint.config.json"), "{}\n", "utf8");
  assert.throws(
    () => factory(context),
    /multiple lint config files found.*lint\.config\.json, ttsc-lint\.config\.json/,
  );

  const caseWorkspace = TestProject.tmpdir("ttsc-lint-host-input-case-");
  const caseProject = path.join(caseWorkspace, "packages", "app");
  fs.mkdirSync(caseProject, { recursive: true });
  const caseVariant = path.join(caseProject, "Lint.Config.Json");
  const canonical = path.join(caseProject, "lint.config.json");
  const ancestor = path.join(caseWorkspace, "lint.config.json");
  fs.writeFileSync(caseVariant, "{}\n", "utf8");
  fs.writeFileSync(ancestor, "{}\n", "utf8");
  const readCase = () =>
    factory({
      ...context,
      cwd: caseProject,
      pluginConfigDir: caseProject,
      projectRoot: caseProject,
      tsconfig: path.join(caseProject, "tsconfig.json"),
    });
  const caseDescriptor = readCase();
  const expectedHash = createHash("sha256").update("{}\n").digest("hex");
  assert.ok(caseDescriptor.hostInputHashes);
  assert.ok(caseDescriptor.hostInputs);
  const variantStat = fs.statSync(caseVariant);
  const canonicalStat = fs.statSync(canonical, { throwIfNoEntry: false });
  const aliases =
    canonicalStat !== undefined &&
    canonicalStat.dev === variantStat.dev &&
    canonicalStat.ino === variantStat.ino;
  if (aliases) {
    assert.equal(caseDescriptor.hostInputHashes[canonical], expectedHash);
    assert.equal(caseDescriptor.hostInputs.includes(ancestor), false);
    assert.equal(
      caseDescriptor.hostInputs.includes(
        path.join(caseWorkspace, "lint.config.ts"),
      ),
      false,
    );
  } else {
    assert.equal(caseDescriptor.hostInputHashes[canonical], null);
    assert.equal(caseDescriptor.hostInputs.includes(ancestor), true);
    assert.equal(caseDescriptor.hostInputHashes[ancestor], expectedHash);
  }
  fs.renameSync(caseVariant, canonical);
  const exact = readCase();
  assert.ok(exact.hostInputHashes);
  assert.ok(exact.hostInputs);
  assert.equal(exact.hostInputHashes[canonical], expectedHash);
  assert.equal(exact.hostInputs.includes(ancestor), false);
  assert.equal(
    exact.hostInputs.includes(path.join(caseWorkspace, "lint.config.ts")),
    false,
  );
}

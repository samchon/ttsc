import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies VS Code server process options leave the environment alone when the
 * project resolves no TypeScript-Go binary.
 *
 * The launcher owns the fallback when the project has no usable compiler, so
 * the extension must not invent a `TTSC_TSGO_BINARY` override: an absent cwd
 * yields no options, and a project whose platform package exists without its
 * executable, or has no `typescript` at all, yields the inherited environment
 * unchanged.
 *
 * 1. Call `serverProcessOptions` without a cwd and with an empty cwd.
 * 2. Call it for a project whose platform package manifest exists but whose
 *    `lib/tsc` executable does not.
 * 3. Call it for a project with no `typescript` package.
 * 4. Assert the cwd is kept and the environment is the inherited object, with no
 *    override added.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real serverProcessOptions with no cwd, an empty cwd, a project whose platform package lacks its executable and a project without typescript, asserting undefined options for the first two and the kept cwd with the inherited process.env object for the others.
 * @evidence contracts/testing.md#independent-expectations The expectations follow from the documented contract that no resolved binary leaves the inherited environment unchanged: the authored fixtures omit the executable or the package, and the expected environment is the very process.env object, so an added TTSC_TSGO_BINARY or a copied environment fails.
 * @evidence contracts/testing.md#distinguishing-cases The absent and empty cwd, the missing executable and the missing typescript package are the negatives; the sibling test test_vscode_server_process_options_inject_project_tsgo_binary owns the positive case with an existing executable.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls serverProcessOptions over package.json files in a TestProject.tmpdir tree, never executing a binary, and starts no extension host or child process.
 */
export function test_vscode_server_process_options_leave_the_environment_without_a_project_tsgo_binary() {
  assert.equal(mod.serverProcessOptions(undefined), undefined);
  assert.equal(mod.serverProcessOptions(""), undefined);

  const missingBinary = TestProject.physicalPath(
    TestProject.tmpdir("vscode-server-options-no-binary-"),
  );
  const platform = `@typescript/typescript-${process.platform}-${process.arch}`;
  const typescript = path.join(missingBinary, "node_modules", "typescript");
  const platformPackage = path.join(
    missingBinary,
    "node_modules",
    "@typescript",
    `typescript-${process.platform}-${process.arch}`,
  );
  fs.mkdirSync(typescript, { recursive: true });
  fs.mkdirSync(platformPackage, { recursive: true });
  fs.writeFileSync(
    path.join(typescript, "package.json"),
    JSON.stringify({ name: "typescript" }),
  );
  fs.writeFileSync(
    path.join(platformPackage, "package.json"),
    JSON.stringify({ name: platform }),
  );

  const noTypescript = TestProject.physicalPath(
    TestProject.tmpdir("vscode-server-options-no-typescript-"),
  );

  for (const project of [missingBinary, noTypescript]) {
    const options = mod.serverProcessOptions(project);
    assert.ok(options, project);
    assert.equal(path.normalize(options.cwd), path.normalize(project));
    assert.equal(
      options.env,
      process.env,
      "the inherited environment must be returned unchanged",
    );
  }
}

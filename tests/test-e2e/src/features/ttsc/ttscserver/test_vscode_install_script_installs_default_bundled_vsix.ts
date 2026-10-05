import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

const { spawnSync } = E2eProcessTrace;

/**
 * Verifies VS Code install script forwards the bundled VSIX by default.
 *
 * The Windows quoting unit covers command construction, while the npm command
 * users run most often is plain `ttsc-vscode`. This pins the default POSIX
 * execution path against a fake `code` binary and the built package layout.
 *
 * 1. Create a fake `code` executable that records its argv.
 * 2. Run `packages/vscode/bin/install.js` with no subcommand.
 * 3. Assert it calls `code --install-extension <versioned VSIX> --force`.
 * 4. Assert the referenced VSIX exists in the package dist directory.
 *
 * @evidence contracts/testing.md#behavioral-verification The npm install entry invokes a recording code command with --install-extension, the versioned bundled VSIX path and --force.
 * @evidence contracts/testing.md#independent-expectations The authored recording executable observes actual argv and the package version independently identifies the default extension artifact.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create a fake `code` executable that records its argv. 2. Run `packages/vscode/bin/install.js` with no subcommand. 3. Assert it calls `code --install-extension <versioned VSIX> --force`. 4. Assert the referenced VSIX exists in the package dist directory.
 * Unavailable host capabilities return false so the runner reports SKIPPED without claiming this case executed its behavioral assertions.
 *
 * @evidence contracts/testing.md#execution-ownership test-e2e's matching src/features/ttsc/ttscserver entry runs the workspace install.js with no subcommand on POSIX; the existing Windows false result is SKIPPED without coverage. A recording code executable replaces the editor, so actual extension installation is not observed.
 * @evidence contracts/e2e.md#necessary-boundary The actual install entry resolves code through child PATH and passes the bundled artifact path to that recording process. Direct argv construction cannot prove this connection; artifact existence alone does not prove extension installation or VSIX contents.
 * @evidence contracts/e2e.md#shared-execution One recording fixture and immutable versioned VSIX serve the default-command profile. The entry invokes uninstall then install; the overwritten log asserts only final install argv. These are distinct actual child invocations, not one inferred launch. No compiler, Go plugin build or packed consumer installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The recording root is retained before preparation and child-only PATH/output prevent other profiles supplying its log. Returned error and signal are checked before status and argv; this synchronous result is not arbitrary descendant closure. Inputs remain retained for later lifecycle verification.
 * @evidence contracts/e2e.md#preserved-coverage The npm install entry invokes a recording code command with --install-extension, the versioned bundled VSIX path and --force. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_vscode_install_script_installs_default_bundled_vsix = ():
  | void
  | false => {
  if (process.platform === "win32") return false;

  const repo = TestProject.WORKSPACE_ROOT;
  const packageRoot = path.join(repo, "packages", "vscode");
  const version = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  ).version as string;
  const expectedVsix = path.join(
    packageRoot,
    "dist",
    `ttsc-vscode-${version}.vsix`,
  );
  assert.ok(fs.existsSync(expectedVsix), `missing VSIX: ${expectedVsix}`);

  const tmp = TestProject.tmpdir("vscode-install-default-");
  TestProject.retainTemporaryDirectory(tmp);
  const bin = path.join(tmp, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(tmp, "code-args.json");
  const fakeCode = path.join(bin, "code");
  fs.writeFileSync(
    fakeCode,
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(process.env.CODE_ARGS_LOG, JSON.stringify(process.argv.slice(2)));
`,
  );
  fs.chmodSync(fakeCode, 0o755);

  const result = spawnSync(
    process.execPath,
    [path.join(packageRoot, "bin", "install.js")],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        CODE_ARGS_LOG: log,
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    },
  );
  if (result.error) throw result.error;
  assert.equal(result.signal, null);
  assert.equal(
    result.status,
    0,
    `install.js failed\nstdout=${result.stdout}\nstderr=${result.stderr}`,
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(log, "utf8")), [
    "--install-extension",
    expectedVsix,
    "--force",
  ]);
};

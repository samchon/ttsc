import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code install script installs the bundled VSIX by default.
 *
 * The Windows quoting unit covers command construction, while the npm command
 * users run most often is plain `ttsc-vscode`. This pins the default POSIX
 * execution path against a fake `code` binary and the built package layout.
 *
 * 1. Create a fake `code` executable that records its argv.
 * 2. Run `packages/vscode/bin/install.js` with no subcommand.
 * 3. Assert it calls `code --install-extension <versioned VSIX> --force`.
 * 4. Assert the referenced VSIX exists in the package dist directory.
 */
export const test_vscode_install_script_installs_default_bundled_vsix = () => {
  if (process.platform === "win32") return;

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

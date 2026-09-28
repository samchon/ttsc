// Format tracked Go files with the repository's gofmt wrapper on every host.
// Pass paths as arguments, not through a shell pipeline: Windows package
// scripts do not provide xargs, and a path can contain spaces or metacharacters.

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function resolveBash() {
  if (process.platform !== "win32") {
    return { binary: "bash", env: process.env };
  }
  const git = childProcess.spawnSync("git", ["--exec-path"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (git.error || git.status !== 0) {
    throw git.error ?? new Error(`git --exec-path failed: ${git.stderr}`);
  }
  const installation = path.resolve(git.stdout.trim(), "..", "..", "..");
  const binary = path.join(installation, "bin", "bash.exe");
  const tools = path.join(installation, "usr", "bin");
  if (!fs.existsSync(binary) || !fs.existsSync(path.join(tools, "perl.exe"))) {
    throw new Error(`Git Bash and Perl were not found under ${installation}`);
  }
  return {
    binary,
    env: {
      ...process.env,
      PATH: [tools, path.join(installation, "bin"), process.env.PATH ?? ""].join(
        path.delimiter,
      ),
    },
  };
}

/** Retry only an OS argument-limit failure by dividing its exact file list. */
function formatBatches(files, execute) {
  const failed = [];
  const visit = (batch) => {
    if (batch.length === 0) return;
    const result = execute(batch);
    if (result.error?.code === "E2BIG" && batch.length > 1) {
      const middle = Math.floor(batch.length / 2);
      visit(batch.slice(0, middle));
      visit(batch.slice(middle));
      return;
    }
    if (result.error) throw result.error;
    if (result.status !== 0) failed.push(batch);
  };
  visit(files);
  return failed;
}

if (require.main === module) {
  const listed = childProcess.spawnSync("git", ["ls-files", "-z", "--", "*.go"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (listed.error || listed.status !== 0) {
    throw listed.error ?? new Error(`git ls-files failed: ${listed.stderr}`);
  }
  const files = listed.stdout.split("\0").filter(Boolean);
  const bash = resolveBash();
  const failed = formatBatches(files, (batch) =>
    childProcess.spawnSync(
      bash.binary,
      ["./.vscode/gofmt-2spaces.sh", "-w", ...batch],
      { cwd: root, env: bash.env, stdio: "inherit", windowsHide: true },
    ),
  );
  if (failed.length !== 0) {
    console.error(`format:go: ${failed.length} batch(es) failed`);
    process.exitCode = 1;
  }
}

module.exports = { formatBatches, resolveBash };

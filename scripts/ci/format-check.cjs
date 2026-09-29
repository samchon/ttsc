// Fail when a tracked file is not what the pinned formatter produces.
//
// The repository drifted 529 files away from its own `pnpm format` output while
// every contributor was individually right to skip running it: the correct
// action produced a diff that buried whatever change it accompanied, so nobody
// took it. A one-time sweep does not fix that — #700 already swept once and the
// drift returned — because the condition reappears with the next unformatted
// commit. Only a gate holds it.
//
// Both halves are checked here. Prettier owns `.ts`/`.md`/`.mdx` and honors
// `.prettierignore`, which already protects the lint corpus fixtures whose exact
// layout is the thing under test. The Go half runs each tracked `.go` file
// through the repository's own `gofmt-2spaces.sh` and compares, because that
// wrapper is the specification and `gofmt` alone is not.

const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

// Bash resolves through a shim on Windows, where a bare spawn fails with
// ENOENT rather than running the command. Git and Node run directly.
function run(command, args, options = {}) {
  return cp.spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: command === "bash",
    windowsHide: true,
    ...options,
  });
}

/** Tracked files as repository-relative paths, without Git's quote escaping. */
function tracked(...patterns) {
  const result = run("git", ["ls-files", "-z", "--", ...patterns]);
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`git ls-files failed: ${result.stderr ?? ""}`);
  return result.stdout.split("\0").filter(Boolean);
}

function prettierDrift() {
  const prettier = require.resolve("prettier/bin/prettier.cjs", {
    paths: [root],
  });
  const files = tracked("*.ts", "*.md", "*.mdx");
  const drift = [];
  // Keep each native command line below Windows' limit. Only tracked inputs
  // reach Prettier, so generated consumers cannot turn an e2e run red.
  for (let index = 0; index < files.length; index += 100) {
    const result = run(process.execPath, [
      prettier,
      "--list-different",
      "--",
      ...files.slice(index, index + 100),
    ]);
    if (result.error) throw result.error;
    if (
      (result.status !== 0 && result.status !== 1) ||
      (result.status === 1 && !result.stdout?.trim())
    )
      throw new Error(
        `prettier --list-different exited ${result.status}, so formatting was not checked:\n${result.stderr ?? ""}`,
      );
    drift.push(...(result.stdout ?? "").split("\n").filter(Boolean));
  }
  return drift;
}

function goDrift() {
  const drift = [];
  for (const file of tracked("*.go")) {
    const current = fs.readFileSync(path.join(root, file), "utf8");
    const formatted = run("bash", ["./.vscode/gofmt-2spaces.sh"], {
      input: current,
    });
    // The wrapper exits non-zero only when gofmt cannot parse the file or is
    // not installed. Skipping either would let an unparseable file, or a lane
    // with no Go toolchain, pass this check silently.
    if (formatted.status !== 0)
      throw new Error(
        `.vscode/gofmt-2spaces.sh exited ${formatted.status} on ${file}:\n${formatted.stderr ?? ""}`,
      );
    if (
      formatted.stdout.replace(/\r\n/g, "\n") !== current.replace(/\r\n/g, "\n")
    )
      drift.push(file);
  }
  return drift;
}

function main() {
  const prettier = prettierDrift();
  const go = goDrift();
  if (prettier.length === 0 && go.length === 0) {
    process.stdout.write("scripts/ci/format-check.cjs: formatting is clean\n");
    return 0;
  }
  for (const file of prettier)
    process.stderr.write(`prettier: ${file} differs from the pinned output\n`);
  for (const file of go)
    process.stderr.write(
      `gofmt-2spaces: ${file} differs from the pinned output\n`,
    );
  process.stderr.write(
    `\n${prettier.length + go.length} file(s) unformatted. Run \`pnpm format\` and commit the result.\n`,
  );
  return 1;
}

module.exports = { goDrift, prettierDrift };

if (require.main === module) process.exit(main());

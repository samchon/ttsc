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
const { resolveBash } = require("../format-go.cjs");

const root = path.resolve(__dirname, "..", "..");

// Run resolved executables directly so shell syntax stays in Bash -c argv.
function run(command, args, options = {}) {
  return cp.spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
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

/** Go/format must come from the SDK that owns the selected gofmt executable. */
function matchingFormattingSdk(bash) {
  const env = { ...bash.env, GOTOOLCHAIN: "local", GOWORK: "off", GOFLAGS: "" };
  // Ask the same shell as the wrapper. Exported shell functions and aliases
  // must keep their actual formatter instead of being mistaken for PATH tools.
  const result = run(
    bash.binary,
    [
      "-c",
      [
        '[ "$(type -t gofmt)" = file ] && [ "$(type -t go)" = file ] || exit 1',
        process.platform === "win32"
          ? 'cygpath -m "$(command -v gofmt)"'
          : "command -v gofmt",
        "go env GOROOT",
      ].join("\n"),
    ],
    { env },
  );
  if (result.error || result.status !== 0) return;
  try {
    const [formatter, sdk] = result.stdout.trim().split(/\r?\n/);
    const expected = fs.realpathSync(
      path.join(
        sdk,
        "bin",
        process.platform === "win32" ? "gofmt.exe" : "gofmt",
      ),
    );
    if (fs.realpathSync(formatter) === expected) return env;
  } catch {}
}

function goDrift(files = tracked("*.go")) {
  if (files.length === 0) return [];
  const drift = [];
  const failures = [];
  const bash = resolveBash();
  const env = matchingFormattingSdk(bash);
  const records = files.map((file) => {
    try {
      return {
        file,
        source: fs.readFileSync(path.resolve(root, file), "utf8"),
      };
    } catch (error) {
      return { file, source: "", error: error.message };
    }
  });
  if (env && records.length) {
    const result = run(
      bash.binary,
      ["./.vscode/gofmt-2spaces.sh", "--check-records"],
      {
        env,
        input:
          records.map((record) => JSON.stringify(record)).join("\n") + "\n",
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    if (result.error) throw result.error;
    const output = result.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if (
      output.length !== records.length ||
      output.some((record, index) => record.file !== records[index].file)
    )
      throw new Error(
        `Go format batch did not report every selected input:\n${result.stderr ?? ""}`,
      );
    for (const record of output) {
      if (record.error) failures.push(`${record.file}: ${record.error}`);
      else if (record.drift) drift.push(record.file);
    }
    if (result.status !== 0 && failures.length === 0)
      failures.push(
        `Go format batch exited ${result.status}: ${result.stderr ?? ""}`,
      );
  } else {
    // A standalone or independently selected gofmt must retain its own engine.
    // It cannot share a formatter compiled from a different SDK's go/format.
    for (const record of records) {
      if (record.error) {
        failures.push(`${record.file}: ${record.error}`);
        continue;
      }
      const formatted = run(bash.binary, ["./.vscode/gofmt-2spaces.sh"], {
        env: bash.env,
        input: record.source,
      });
      if (formatted.error || formatted.status !== 0)
        failures.push(
          `${record.file}: ${formatted.error?.message ?? formatted.stderr ?? `exit ${formatted.status}`}`,
        );
      else if (
        formatted.stdout.replace(/\r\n/g, "\n") !==
        record.source.replace(/\r\n/g, "\n")
      )
        drift.push(record.file);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures.map((message) => new Error(message)),
      `Go formatting failed:\n${failures.join("\n")}\nUnformatted: ${drift.join(", ")}`,
    );
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

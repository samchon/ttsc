const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveBash } = require("../../../../../../../scripts/format-go.cjs");

const root = path.resolve(__dirname, "../../../../../../..");
const WRAPPER = path.join(root, ".vscode", "gofmt-2spaces.sh");

/** A temporary directory holding its own copy of the wrapper. */
function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-gofmt-"));
  fs.copyFileSync(WRAPPER, path.join(directory, "gofmt-2spaces.sh"));
  fs.copyFileSync(
    path.join(root, ".vscode", "gofmt-check.go"),
    path.join(directory, "gofmt-check.go"),
  );
  return directory;
}

// Use the same actual Git Bash and Perl resolution as the write and check paths.
function bash(cwd, args, options = {}) {
  const bash = resolveBash();
  return cp.spawnSync(bash.binary, ["./gofmt-2spaces.sh", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...bash.env, GOTOOLCHAIN: "local", GOWORK: "off", GOFLAGS: "" },
    windowsHide: true,
    ...options,
  });
}

/** The stdin path — the one the CI format gate compares every file against. */
function normalized(source) {
  const directory = workspace();
  try {
    const result = bash(directory, [], { input: source });
    assert.equal(
      result.status,
      0,
      `the wrapper exited ${result.status}:\n${result.stderr ?? ""}`,
    );
    return result.stdout.replace(/\r\n/g, "\n");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * The write path — the one `pnpm format` runs.
 *
 * `files` maps a relative path to its content. `args` defaults to every one of
 * those paths, so a case can pass a directory, or a name that does not exist,
 * instead. Returns each seeded file's content after the run.
 */
function written(files, args) {
  const directory = workspace();
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(directory, name)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(directory, name), content);
    }
    const result = bash(directory, ["-w", ...(args ?? Object.keys(files))]);
    const after = {};
    for (const name of Object.keys(files))
      after[name] = fs
        .readFileSync(path.join(directory, name), "utf8")
        .replace(/\r\n/g, "\n");
    return { status: result.status, stderr: result.stderr ?? "", after };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/** A source whose only tab is inside a raw string literal. */
const RAW_STRING_TAB =
  "package a\n" +
  "\n" +
  "const Fixture = `if (a)\n" +
  "\tx();\n" +
  "`\n" +
  "\n" +
  "func A() {\n" +
  "\tprintln(Fixture)\n" +
  "}\n";

module.exports = { workspace, bash, normalized, written, RAW_STRING_TAB };

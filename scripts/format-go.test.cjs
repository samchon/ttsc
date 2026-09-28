const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { formatBatches, resolveBash } = require("./format-go.cjs");
const root = path.resolve(__dirname, "..");

test("Go formatting preserves every tracked path when the argument list is too long", () => {
  const files = ["a.go", "directory with spaces/b.go", "c.go", "d.go", "e.go"];
  const seen = [];
  const failed = formatBatches(files, (batch) => {
    if (batch.length > 2) {
      return { error: Object.assign(new Error("too long"), { code: "E2BIG" }) };
    }
    seen.push(...batch);
    return { status: batch.includes("d.go") ? 1 : 0 };
  });
  assert.deepEqual(seen, files);
  assert.deepEqual(failed.flat(), ["d.go", "e.go"]);

  const bash = resolveBash();
  if (process.platform === "win32") assert.equal(fs.existsSync(bash.binary), true);
  else assert.equal(bash.binary, "bash");
});

test("Go formatting invokes the wrapper for a path with spaces without changing a literal tab", () => {
  const directory = fs.mkdtempSync(path.join(root, ".format-go-case "));
  const file = path.join(directory, "sample name.go");
  try {
    fs.writeFileSync(
      file,
      "package main\n\nconst raw = `a\tb`\n\nfunc main(){\nprintln(raw)\n}\n",
    );
    const bash = resolveBash();
    const relative = path.relative(root, file).split(path.sep).join("/");
    const results = [];
    const failed = formatBatches([relative], (batch) => {
      const result = childProcess.spawnSync(
        bash.binary,
        ["./.vscode/gofmt-2spaces.sh", "-w", ...batch],
        { cwd: root, encoding: "utf8", env: bash.env, windowsHide: true },
      );
      results.push(result);
      return result;
    });
    const stderr = results.map((result) => result.stderr).join("\n");
    assert.deepEqual(failed, [], stderr);
    assert.equal(
      fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
      "package main\n\nconst raw = `a\tb`\n\nfunc main() {\n  println(raw)\n}\n",
    );
  } finally {
    fs.rmSync(file, { force: true });
    fs.rmdirSync(directory);
  }
});

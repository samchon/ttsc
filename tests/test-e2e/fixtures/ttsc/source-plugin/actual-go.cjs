const fs = require("node:fs");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");

const args = process.argv.slice(2);
if (args[0] === "build") {
  for (const relative of [
    "internal/rules/rule.go",
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    assert.equal(
      fs.readFileSync(path.join(process.cwd(), relative), "utf8").replace(/\r\n/g, "\n"),
      "package rules\n",
      relative,
    );
  }
  assert.equal(fs.lstatSync(path.join(process.cwd(), ".git")).isFile(), true);
  assert.equal(fs.readFileSync(path.join(process.cwd(), ".git"), "utf8").replace(/\r\n/g, "\n"), "gitdir: ../.git/worktrees/plugin\n");
  assert.equal(fs.lstatSync(path.join(process.cwd(), "notes~")).isDirectory(), true);
  assert.equal(fs.readFileSync(path.join(process.cwd(), "notes~", "notes.txt"), "utf8").replace(/\r\n/g, "\n"), "kept notes\n");
}
fs.appendFileSync(process.env.TTSC_TEST_GO_INVOCATIONS, JSON.stringify(args) + "\n");
const result = cp.spawnSync(process.env.TTSC_TEST_ACTUAL_GO, args, { stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

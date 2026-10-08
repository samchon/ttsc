const fs = require("node:fs");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");

const args = process.argv.slice(2);
if (args[0] === "version" && process.env.TTSC_TEST_GO_REWRITE_LAUNCHER) {
  const launcher = process.env.TTSC_TEST_GO_REWRITE_LAUNCHER;
  const restore = process.env.TTSC_TEST_GO_RESTORE_LAUNCHER_BYTES === "1";
  const original = restore ? fs.readFileSync(launcher) : undefined;
  const metadata = restore ? fs.statSync(launcher) : undefined;
  fs.appendFileSync(
    launcher,
    process.platform === "win32" ? "\r\nrem changed during version\r\n" : "\n# changed during version\n",
  );
  if (restore) {
    fs.writeFileSync(launcher, original);
    fs.utimesSync(launcher, metadata.atime, metadata.mtime);
  }
}
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
const recording = args[0] === "build" && process.env.TTSC_TEST_GO_BUILD_TRACE;
const toolchainBefore = recording ? toolchainMetadata() : undefined;
const result = cp.spawnSync(process.env.TTSC_TEST_ACTUAL_GO, recording ? ["build", "-x", ...args.slice(1)] : args,
  recording ? { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 } : { stdio: "inherit", windowsHide: true });
let rewroteLauncher = false;
let poisonedRelease = false;
if (args[0] === "build") {
  const launcher = process.env.TTSC_TEST_GO_REWRITE_BUILD_LAUNCHER;
  if (launcher) {
    const mode = process.env.TTSC_TEST_GO_REWRITE_BUILD_MODE;
    assert.ok(mode === "once" || mode === "always");
    let rewrite = mode === "always";
    if (mode === "once") {
      try {
        fs.writeFileSync(process.env.TTSC_TEST_GO_REWRITE_BUILD_MARKER, "claimed\n", { flag: "wx" });
        rewrite = true;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    if (rewrite) {
      const original = fs.statSync(launcher);
      fs.appendFileSync(launcher, process.platform === "win32"
        ? "\r\nrem changed during build\r\n"
        : "\n# changed during build\n");
      fs.utimesSync(launcher, original.atime, original.mtime);
      rewroteLauncher = true;
      if (process.env.TTSC_TEST_GO_REWRITE_SOURCE)
        fs.appendFileSync(process.env.TTSC_TEST_GO_REWRITE_SOURCE, "\n// changed during toolchain epoch\n");
    }
  }
  if (process.env.TTSC_TEST_GO_FAIL_RELEASE_ROOT) {
    const root = process.env.TTSC_TEST_GO_FAIL_RELEASE_ROOT;
    const held = fs.readdirSync(root)
      .filter((entry) => entry.endsWith(".lock.v3"))
      .map((entry) => path.join(root, entry, "current"))
      .filter((entry) => fs.existsSync(entry));
    assert.equal(held.length, 1, "poison only this private request's held generation");
    const marker = path.join(held[0], "task-complete");
    fs.mkdirSync(marker);
    fs.writeFileSync(path.join(marker, "owned-fault"), "completion cannot replace a directory\n");
    poisonedRelease = true;
  }
}
if (recording) {
  fs.appendFileSync(process.env.TTSC_TEST_GO_BUILD_TRACE, JSON.stringify({
    cwd: process.cwd(), stderr: result.stderr ?? "", status: result.status,
    signal: result.signal, toolchainBefore, toolchainAfter: toolchainMetadata(),
    rewroteLauncher, poisonedRelease,
  }) + "\n");
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
if (result.error) throw result.error;
process.exit(result.status ?? 1);

// Observe the selected launcher and all SDK executables without executing or
// warming them. Access time is deliberately outside the witness contract.
function toolchainMetadata() {
  const observed = {};
  const visit = (location) => {
    let stat;
    try {
      stat = fs.statSync(location, { bigint: true });
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      observed[location] = "missing";
      return;
    }
    observed[location] = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
    if (stat.isDirectory())
      for (const entry of fs.readdirSync(location).sort()) visit(path.join(location, entry));
  };
  if (process.env.TTSC_GO_BINARY) visit(process.env.TTSC_GO_BINARY);
  if (process.env.TTSC_TEST_GO_TOOL_ROOT) {
    visit(path.join(process.env.TTSC_TEST_GO_TOOL_ROOT, "bin"));
    visit(path.join(process.env.TTSC_TEST_GO_TOOL_ROOT, "pkg", "tool"));
  }
  return observed;
}

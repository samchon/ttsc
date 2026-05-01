const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  copyProject,
  runNode,
  spawn,
  ttscBin,
  workspaceRoot,
} = require("./_helpers.cjs");

test("native transformer project: Go sidecar handles project build", () => {
  const root = copyProject("go-native-transformer");
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_GO_TRANSFORMER_SOURCE: goTransformerSource(),
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const out = path.join(root, "dist", "main.js");
  const js = fs.readFileSync(out, "utf8");
  assert.match(js, /GO NATIVE TRANSFORMER/);
  const run = runNode(out, { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "GO NATIVE TRANSFORMER");
});

function goTransformerSource() {
  return path.join(
    workspaceRoot,
    "tests",
    "go-transformer",
    "cmd",
    "ttsc-go-transformer",
  );
}

function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

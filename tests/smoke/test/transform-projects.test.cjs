const assert = require("node:assert/strict");
const child_process = require("node:child_process");
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

function transformToFile(root, source, out, options = {}) {
  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", source, "--out", out],
    { cwd: root, env: options.env },
  );
  assert.equal(result.status, 0, result.stderr);
  return fs.readFileSync(out, "utf8");
}

const transformProjects = [
  {
    name: "ts-node hello-world style CommonJS transform executes",
    fixture: "transform-hello",
    source: "src/hello.ts",
    out: "out/hello.js",
    assert(root, out) {
      const run = runNode(out, { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "Hello, world!");
    },
  },
  {
    name: "ts-node ext-cts style .cts transform executes as .cjs",
    fixture: "transform-cts",
    source: "src/main.cts",
    out: "out/main.cjs",
    assert(root, out) {
      const run = runNode(out, { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "cts-transform");
    },
  },
  {
    name: "ts-node ext-mts style .mts transform executes as .mjs",
    fixture: "transform-mts",
    source: "src/main.mts",
    out: "out/main.mjs",
    assert(root, out) {
      const run = runNode(out, { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "mts-transform");
    },
  },
  {
    name: "tsx file transform preserves JSX lowering settings",
    fixture: "transform-tsx",
    source: "src/view.tsx",
    out: "out/view.js",
    assert(_root, out) {
      const js = fs.readFileSync(out, "utf8");
      assert.match(js, /h\("div", null\)/);
    },
  },
  {
    name: "file paths with spaces transform without shell quoting assumptions",
    fixture: "transform-space",
    source: "src/throw error.ts",
    out: "out/throw error.js",
    assert(root, out) {
      const run = runNode(out, { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "space-ok");
    },
  },
  {
    name: "transform respects tsconfig extends chain",
    fixture: "transform-extends",
    source: "src/main.ts",
    out: "out/main.js",
    assert(root, out) {
      const run = runNode(out, { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "extends-transform");
    },
  },
];

for (const project of transformProjects) {
  test(`transform project corpus: ${project.name}`, () => {
    const root = copyProject(project.fixture);
    const out = path.join(root, project.out);
    transformToFile(root, project.source, out);
    project.assert(root, out);
  });
}

test("transform project corpus: transform diagnostics fail before writing output", () => {
  const root = copyProject("transform-diagnostic");
  const out = path.join(root, "out", "main.js");
  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts", "--out", out],
    { cwd: root },
  );
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Argument of type 'number' is not assignable to parameter of type 'string'/,
  );
  assert.equal(fs.existsSync(out), false);
});

test("transform project corpus: Go native transformer library backs plugin-selected binary", () => {
  const transformerBinary = buildGoTransformer();
  const root = copyProject("go-native-transformer");
  const out = path.join(root, "out", "main.js");
  transformToFile(root, "src/main.ts", out, {
    env: {
      TTSC_GO_TRANSFORMER_BINARY: transformerBinary,
    },
  });
  const js = fs.readFileSync(out, "utf8");
  assert.match(js, /GO NATIVE TRANSFORMER/);
  const run = runNode(out, { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "GO NATIVE TRANSFORMER");
});

function buildGoTransformer() {
  const root = path.join(workspaceRoot, "tests", "go-transformer");
  const output = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-go-transformer-")),
    process.platform === "win32" ? "ttsc-go-transformer.exe" : "ttsc-go-transformer",
  );
  const result = child_process.spawnSync(
    "go",
    ["build", "-o", output, "./cmd/ttsc-go-transformer"],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: goPath(),
      },
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return output;
}

function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

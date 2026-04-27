const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  commonJsProject,
  spawn,
  ttscBin,
  workspaceRoot,
} = require("./_helpers.cjs");

function pluginProject(pluginEntries, pluginFiles) {
  return commonJsProject(
    {
      ...pluginFiles,
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    },
    {
      compilerOptions: {
        plugins: pluginEntries,
      },
    },
  );
}

function nativePlugin(mode) {
  return `
    module.exports = (config) => ({
      name: config.name,
      native: {
        mode: ${JSON.stringify(mode)},
        binary: process.env.TTSC_GO_TRANSFORMER_BINARY,
        contractVersion: 1,
      },
    });
  `;
}

test("plugin corpus: default export factory is accepted as a native descriptor", () => {
  const transformerBinary = buildGoTransformer();
  const root = pluginProject(
    [{ transform: "./plugins/default.cjs", name: "default-shape" }],
    {
      "plugins/default.cjs": `
        exports.default = (config) => ({
          name: config.name,
          native: {
            mode: "go-uppercase",
            binary: process.env.TTSC_GO_TRANSFORMER_BINARY,
            contractVersion: 1,
          },
        });
      `,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { TTSC_GO_TRANSFORMER_BINARY: transformerBinary },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );
});

test("plugin corpus: createTtscPlugin export is accepted as a native descriptor", () => {
  const transformerBinary = buildGoTransformer();
  const root = pluginProject(
    [{ transform: "./plugins/create.cjs", name: "create-export" }],
    {
      "plugins/create.cjs": `
        exports.createTtscPlugin = (config) => ({
          name: config.name,
          native: {
            mode: "go-uppercase",
            binary: process.env.TTSC_GO_TRANSFORMER_BINARY,
            contractVersion: 1,
          },
        });
      `,
    },
  );

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts"],
    { cwd: root, env: { TTSC_GO_TRANSFORMER_BINARY: transformerBinary } },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"PLUGIN"/);
});

test("plugin corpus: ordered native plugins are passed to the Go sidecar", () => {
  const transformerBinary = buildGoTransformer();
  const root = pluginProject(
    [
      { transform: "./plugins/prefix.cjs", name: "prefix", prefix: "A:" },
      { transform: "./plugins/disabled.cjs", name: "disabled", enabled: false, suffix: ":NO" },
      { transform: "./plugins/upper.cjs", name: "upper" },
      { transform: "./plugins/suffix.cjs", name: "suffix", suffix: ":Z" },
    ],
    {
      "plugins/prefix.cjs": nativePlugin("go-prefix"),
      "plugins/disabled.cjs": nativePlugin("go-suffix"),
      "plugins/upper.cjs": nativePlugin("go-uppercase"),
      "plugins/suffix.cjs": nativePlugin("go-suffix"),
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { TTSC_GO_TRANSFORMER_BINARY: transformerBinary },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /"A:PLUGIN:Z"/);
});

test("plugin corpus: JS transform hooks are rejected", () => {
  const root = pluginProject(
    [{ transform: "./plugins/invalid-hook.cjs" }],
    {
      "plugins/invalid-hook.cjs": `
        module.exports = {
          name: "invalid-hook",
          transformOutput(context) {
            return context.code;
          },
        };
      `,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported JS transform hooks/);
});

test("plugin corpus: invalid plugin export reports the bad specifier", () => {
  const root = pluginProject(
    [{ transform: "./plugins/invalid.cjs" }],
    {
      "plugins/invalid.cjs": `module.exports = 123;\n`,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not export a valid ttsc plugin/);
});

test("plugin corpus: transform --out receives Go native output", () => {
  const transformerBinary = buildGoTransformer();
  const root = pluginProject(
    [{ transform: "./plugins/out.cjs", name: "out" }],
    {
      "plugins/out.cjs": nativePlugin("go-uppercase"),
    },
  );
  const output = path.join(root, "custom", "main.js");

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts", "--out", output],
    { cwd: root, env: { TTSC_GO_TRANSFORMER_BINARY: transformerBinary } },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(output, "utf8"), /"PLUGIN"/);
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

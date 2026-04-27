const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  commonJsProject,
  copyProject,
  nativeBinary,
  spawn,
  tsgoBinary,
  ttscBin,
  ttsxBin,
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

test("plugin corpus: source plugins are built locally and used", () => {
  const root = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-cache-"),
  );
  const env = {
    PATH: goPath(),
    TTSC_CACHE_DIR: cacheDir,
  };

  const cold = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
  assert.equal(cold.status, 0, cold.stderr);
  assert.match(cold.stderr, /building source plugin "go-source-plugin"/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );

  const warm = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
  assert.equal(warm.status, 0, warm.stderr);
  assert.doesNotMatch(warm.stderr, /building source plugin/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );
});

test("plugin corpus: source plugins serve an ordered --plugins-json pipeline", () => {
  const root = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-ordered-"),
  );
  // Override plugin.cjs to expose a config-driven manifest factory so we can
  // declare prefix → upper → suffix as ordered entries that all share the
  // same source dir (and therefore the same compiled binary).
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `const path = require("node:path");
module.exports = (config) => ({
  name: config.name,
  native: {
    mode: config.mode,
    source: { dir: path.resolve(__dirname, "go-plugin") },
    contractVersion: 1,
  },
});
`,
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [
          { transform: "./plugin.cjs", name: "prefix", mode: "go-prefix", prefix: "A:" },
          { transform: "./plugin.cjs", name: "upper", mode: "go-uppercase" },
          { transform: "./plugin.cjs", name: "suffix", mode: "go-suffix", suffix: ":Z" },
        ],
      },
      include: ["src"],
    }),
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"A:PLUGIN:Z"/,
  );
});

test("plugin corpus: source plugin cache invalidates when Go source changes", () => {
  const root = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-invalidate-"),
  );
  const env = {
    PATH: goPath(),
    TTSC_CACHE_DIR: cacheDir,
  };

  const first = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stderr, /building source plugin/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );

  // Edit the actual go-uppercase branch so the hash changes AND the new
  // behavior is observable end-to-end.
  const goFile = path.join(root, "go-plugin", "main.go");
  const original = fs.readFileSync(goFile, "utf8");
  fs.writeFileSync(
    goFile,
    original.replace(
      `case "go-uppercase":
			value = strings.ToUpper(value)`,
      `case "go-uppercase":
			value = "[" + strings.ToUpper(value) + "]"`,
    ),
  );

  const second = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stderr, /building source plugin/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"\[PLUGIN\]"/,
  );
});

test("plugin corpus: native.source.entry selects a sub-package", () => {
  const root = copyProject("go-source-plugin-entry");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-entry-"),
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /building source plugin "go-source-plugin-entry"/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"ENTRY"/,
  );
});

test("plugin corpus: declaring both native.source and native.binary is rejected", () => {
  const root = pluginProject(
    [{ transform: "./plugins/conflict.cjs", name: "conflict" }],
    {
      "plugins/conflict.cjs": `
        const path = require("node:path");
        module.exports = {
          name: "conflict",
          native: {
            mode: "go-uppercase",
            binary: "/some/path/to/binary",
            source: { dir: path.resolve(__dirname, "..", "go-plugin") },
            contractVersion: 1,
          },
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /must use either native\.binary or native\.source, not both/,
  );
});

test("plugin corpus: missing native.source.dir produces a clear error", () => {
  const root = pluginProject(
    [{ transform: "./plugins/empty-source.cjs", name: "empty" }],
    {
      "plugins/empty-source.cjs": `
        module.exports = {
          name: "empty",
          native: {
            mode: "go-uppercase",
            source: { dir: "" },
            contractVersion: 1,
          },
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /native\.source\.dir must be a non-empty string/);
});

test("plugin corpus: source plugin build failure reports Go compiler stderr", () => {
  const root = copyProject("go-source-plugin");
  // Inject a syntax error into the Go source.
  const goFile = path.join(root, "go-plugin", "main.go");
  const original = fs.readFileSync(goFile, "utf8");
  fs.writeFileSync(
    goFile,
    original.replace("package main", "package main\nthis is not valid go;"),
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-source-plugin-broken-"),
      ),
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /building plugin "go-source-plugin" via "go build" failed/,
  );
});

test("plugin corpus: missing Go toolchain points users at the install hint", () => {
  const root = copyProject("go-source-plugin");
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      // Strip Go binaries from PATH and force lookup of a guaranteed-missing
      // toolchain via TTSC_GO_BINARY.
      PATH: "/nonexistent",
      TTSC_GO_BINARY: "/nonexistent/go-binary-that-does-not-exist",
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-source-plugin-no-go-"),
      ),
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Go toolchain was not found/);
  assert.match(result.stderr, /TTSC_GO_BINARY/);
});

test("plugin corpus: ttsc transform single-file mode drives the source plugin", () => {
  const root = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-transform-"),
  );
  const out = path.join(root, "out", "main.js");
  const result = spawn(
    ttscBin,
    [
      "transform",
      "--cwd",
      root,
      "--file",
      path.join(root, "src", "main.ts"),
      "--out",
      out,
    ],
    {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(out, "utf8"), /"PLUGIN"/);
});

test("plugin corpus: ttsx executes source plugin output end-to-end", () => {
  const root = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-ttsx-"),
  );
  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "PLUGIN");
});

test("plugin corpus: programmatic transformAsync drives the source plugin", async () => {
  const root = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-async-"),
  );
  const harnessFile = path.join(root, "harness.cjs");
  const ttscPackage = path.join(workspaceRoot, "packages", "ttsc");
  fs.writeFileSync(
    harnessFile,
    `const ttsc = require(${JSON.stringify(ttscPackage)});
ttsc
  .transformAsync({ cwd: ${JSON.stringify(root)}, file: ${JSON.stringify(path.join(root, "src", "main.ts"))} })
  .then((text) => { process.stdout.write(text); })
  .catch((error) => {
    process.stderr.write(error.stack || String(error));
    process.exit(1);
  });
`,
  );
  const result = spawn(process.execPath, [harnessFile], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"PLUGIN"/);
});

test("plugin corpus: source plugin bootstraps a Program and Checker against the consumer tsconfig", () => {
  const root = copyProject("go-source-plugin-checker");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-checker-"),
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /building source plugin "go-source-plugin-checker"/,
  );
  const out = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(out, /"User"/);
  assert.match(out, /"string\[\]"/);
});

test("plugin corpus: source plugin walks AST + uses Checker to enumerate interface properties", () => {
  const root = copyProject("go-source-plugin-properties");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-properties-"),
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /building source plugin "go-source-plugin-properties"/,
  );
  const out = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(out, /\["id","email","name"\]/);
  assert.match(out, /\["sku","price"\]/);
});

test("plugin corpus: source plugin can import tsgo shim modules via go.work overlay", () => {
  const root = copyProject("go-source-plugin-tsgo");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-tsgo-"),
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /building source plugin "go-source-plugin-tsgo"/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"TSGO \(tsgo\)"/,
  );
});

test("plugin corpus: concurrent ttsc invocations on a cold cache both succeed", async () => {
  const rootA = copyProject("go-source-plugin");
  const rootB = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-race-"),
  );
  const env = {
    ...process.env,
    PATH: goPath(),
    TTSC_CACHE_DIR: cacheDir,
    TTSC_BINARY: nativeBinary,
    TTSC_TSGO_BINARY: tsgoBinary,
  };

  function launch(root) {
    return new Promise((resolve, reject) => {
      const child = child_process.spawn(
        process.execPath,
        [ttscBin, "--cwd", root, "--emit"],
        {
          cwd: root,
          env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr, root }));
    });
  }

  const [a, b] = await Promise.all([launch(rootA), launch(rootB)]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.match(
    fs.readFileSync(path.join(rootA, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );
  assert.match(
    fs.readFileSync(path.join(rootB, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );
});

test("plugin corpus: nonexistent native.source.dir produces a clear error", () => {
  const root = pluginProject(
    [{ transform: "./plugins/missing-dir.cjs", name: "missing" }],
    {
      "plugins/missing-dir.cjs": `
        const path = require("node:path");
        module.exports = {
          name: "missing",
          native: {
            mode: "go-uppercase",
            source: { dir: path.resolve(__dirname, "..", "no-such-dir") },
            contractVersion: 1,
          },
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath() },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /native\.source\.dir does not exist/);
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

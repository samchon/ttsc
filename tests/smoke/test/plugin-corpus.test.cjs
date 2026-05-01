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

function nativePlugin() {
  return `
    module.exports = (context) => ({
      name: context.plugin.name,
      source: require("node:path").resolve(
        __dirname,
        "..",
        "go-plugin",
        "cmd",
        "ttsc-go-transformer"
      ),
    });
  `;
}

function copyDirectory(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

test("plugin corpus: default export factory is accepted as a native descriptor", () => {
  const root = pluginProject(
    [{ transform: "./plugins/default.cjs", name: "default-shape" }],
    {
      "plugins/default.cjs": `
        exports.default = (context) => ({
          name: context.plugin.name,
          source: require("node:path").resolve(
            __dirname,
            "..",
            "go-plugin",
            "cmd",
            "ttsc-go-transformer"
          ),
        });
      `,
    },
  );
  copyDirectory(
    path.join(workspaceRoot, "tests", "go-transformer"),
    path.join(root, "go-plugin"),
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath() },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );
});

test("plugin corpus: createTtscPlugin export is accepted as a native descriptor", () => {
  const root = pluginProject(
    [{ transform: "./plugins/create.cjs", name: "create-export" }],
    {
      "plugins/create.cjs": `
        exports.createTtscPlugin = (context) => ({
          name: context.plugin.name,
          source: require("node:path").resolve(
            __dirname,
            "..",
            "go-plugin",
            "cmd",
            "ttsc-go-transformer"
          ),
        });
      `,
    },
  );
  copyDirectory(
    path.join(workspaceRoot, "tests", "go-transformer"),
    path.join(root, "go-plugin"),
  );

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts"],
    { cwd: root, env: { PATH: goPath() } },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"PLUGIN"/);
});

test("plugin corpus: ordered native plugins are passed to the Go sidecar", () => {
  const root = pluginProject(
    [
      { transform: "./plugins/prefix.cjs", name: "prefix", prefix: "A:" },
      {
        transform: "./plugins/disabled.cjs",
        name: "disabled",
        enabled: false,
        suffix: ":NO",
      },
      { transform: "./plugins/upper.cjs", name: "upper" },
      { transform: "./plugins/suffix.cjs", name: "suffix", suffix: ":Z" },
    ],
    {
      "plugins/prefix.cjs": nativePlugin(),
      "plugins/disabled.cjs": nativePlugin(),
      "plugins/upper.cjs": nativePlugin(),
      "plugins/suffix.cjs": nativePlugin(),
    },
  );
  copyDirectory(
    path.join(workspaceRoot, "tests", "go-transformer"),
    path.join(root, "go-plugin"),
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath() },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /"A:PLUGIN:Z"/);
});

test("plugin corpus: JS transform hooks are rejected", () => {
  const root = pluginProject([{ transform: "./plugins/invalid-hook.cjs" }], {
    "plugins/invalid-hook.cjs": `
        module.exports = {
          name: "invalid-hook",
          transformOutput(context) {
            return context.code;
          },
        };
      `,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported JS transform hooks/);
});

test("plugin corpus: invalid plugin export reports the bad specifier", () => {
  const root = pluginProject([{ transform: "./plugins/invalid.cjs" }], {
    "plugins/invalid.cjs": `module.exports = 123;\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not export a valid ttsc plugin/);
});

test("plugin corpus: transform --out receives Go native output", () => {
  const root = pluginProject(
    [{ transform: "./plugins/out.cjs", name: "out" }],
    {
      "plugins/out.cjs": nativePlugin(),
    },
  );
  copyDirectory(
    path.join(workspaceRoot, "tests", "go-transformer"),
    path.join(root, "go-plugin"),
  );
  const output = path.join(root, "custom", "main.js");

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts", "--out", output],
    { cwd: root, env: { PATH: goPath() } },
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
  // Override plugin.cjs to expose a context-driven manifest factory so we can
  // declare prefix → upper → suffix as ordered entries that all share the
  // same source dir (and therefore the same compiled binary).
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `const path = require("node:path");
module.exports = (context) => ({
  name: context.plugin.name,
  source: path.resolve(__dirname, "go-plugin"),
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
          { transform: "./plugin.cjs", name: "prefix", prefix: "A:" },
          { transform: "./plugin.cjs", name: "upper" },
          { transform: "./plugin.cjs", name: "suffix", suffix: ":Z" },
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

test("plugin corpus: source path selects a sub-package", () => {
  const root = copyProject("go-source-plugin-entry");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-entry-"),
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /building source plugin "go-source-plugin-entry"/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"ENTRY"/,
  );
});

test("plugin corpus: source path can point directly at go.mod", () => {
  const root = copyProject("go-source-plugin");
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `const path = require("node:path");
module.exports = {
  name: "go-source-plugin",
  source: path.resolve(__dirname, "go-plugin", "go.mod"),
};
`,
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-source-plugin-gomod-"),
      ),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );
});

test("plugin corpus: source path searches at most three parents for go.mod", () => {
  const root = copyProject("go-source-plugin");
  const tooDeep = path.join(root, "go-plugin", "a", "b", "c", "d");
  fs.mkdirSync(tooDeep, { recursive: true });
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `const path = require("node:path");
module.exports = {
  name: "go-source-plugin-too-deep",
  source: path.resolve(__dirname, "go-plugin", "a", "b", "c", "d"),
};
`,
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-source-plugin-too-deep-"),
      ),
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /go\.mod within 3 parent directories/);
});

test("plugin corpus: missing source is rejected", () => {
  const root = pluginProject(
    [{ transform: "./plugins/missing-source.cjs", name: "missing-source" }],
    {
      "plugins/missing-source.cjs": `
        module.exports = {
          name: "missing-source",
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must declare source/);
});

test("plugin corpus: empty source produces a clear error", () => {
  const root = pluginProject(
    [{ transform: "./plugins/empty-source.cjs", name: "empty" }],
    {
      "plugins/empty-source.cjs": `
        module.exports = {
          name: "empty",
          source: "",
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must declare source/);
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

test("plugin corpus: source plugins build with the bundled Go compiler", () => {
  const root = copyProject("go-source-plugin");
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: "/nonexistent",
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-source-plugin-bundled-go-"),
      ),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
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

test("plugin corpus: programmatic transform drives the source plugin", () => {
  const root = copyProject("go-source-plugin");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-source-plugin-transform-"),
  );
  const harnessFile = path.join(root, "harness.cjs");
  const ttscPackage = path.join(workspaceRoot, "packages", "ttsc");
  fs.writeFileSync(
    harnessFile,
    `const ttsc = require(${JSON.stringify(ttscPackage)});
try {
  process.stdout.write(
    ttsc.transform({ cwd: ${JSON.stringify(root)}, file: ${JSON.stringify(path.join(root, "src", "main.ts"))} }),
  );
} catch (error) {
  process.stderr.write(error.stack || String(error));
  process.exit(1);
}
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
  assert.match(result.stderr, /building source plugin "go-source-plugin-tsgo"/);
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

test("plugin corpus: nonexistent source produces a clear error", () => {
  const root = pluginProject(
    [{ transform: "./plugins/missing-dir.cjs", name: "missing" }],
    {
      "plugins/missing-dir.cjs": `
        const path = require("node:path");
        module.exports = {
          name: "missing",
          source: path.resolve(__dirname, "..", "no-such-dir"),
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath() },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source does not exist/);
});

test("plugin corpus: @ttsc/lint surfaces rule violations through the normal failure path", () => {
  const root = setupLintProject("lint-violations");
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-lint-violations-"),
  );
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.notEqual(result.status, 0, "expected lint errors to fail the build");

  // Build the expected diagnostic set from `// expect:` annotations in
  // the fixture. Every annotation pins (rule, severity) at the next
  // non-comment, non-blank line — the renderer's `path:line:col` banner
  // must match the line we annotated.
  const sourcePath = path.join(root, "src", "main.ts");
  const expected = parseExpectations(sourcePath);
  const got = parseDiagnostics(result.stderr, sourcePath);

  // 1. No diagnostic is missing.
  for (const exp of expected) {
    const hit = got.find(
      (g) =>
        g.line === exp.line &&
        g.rule === exp.rule &&
        g.severity === exp.severity,
    );
    assert.ok(
      hit,
      `expected ${exp.severity} [${exp.rule}] at line ${exp.line}; stderr=\n${result.stderr}`,
    );
  }

  // 2. No diagnostic is unexpected.
  for (const g of got) {
    const hit = expected.find(
      (exp) =>
        exp.line === g.line &&
        exp.rule === g.rule &&
        exp.severity === g.severity,
    );
    assert.ok(
      hit,
      `unexpected ${g.severity} [${g.rule}] at line ${g.line}; not annotated in fixture\n${result.stderr}`,
    );
  }

  // 3. The "off" rule never fires (sanity — `probe(x: number | null)`
  // returns `x!`, which would otherwise trigger no-non-null-assertion).
  assert.doesNotMatch(result.stderr, /\[no-non-null-assertion\]/);
});

test("plugin corpus: @ttsc/lint clean project exits zero", () => {
  const root = setupLintProject("lint-violations");
  // Replace the violating source with a clean file.
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "hi";\nconst _value: number = value.length;\nvoid _value;\n`,
  );
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-clean-"));
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
});

test("plugin corpus: @ttsc/lint honors --emit and --outDir overrides", () => {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        noEmit: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [
          {
            transform: "@ttsc/lint",
            config: {},
          },
        ],
      },
      include: ["src"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "lint-outdir";\n`,
  );
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-outdir-"));

  const result = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--outDir", "custom"],
    {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, "custom", "main.js")), true);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
});

test("plugin corpus: @ttsc/lint ignores future optional flags", () => {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/lint", config: {} }],
      },
      include: ["src"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "future-flag";\n`,
  );

  const { loadProjectPlugins } = require(
    path.join(
      workspaceRoot,
      "packages",
      "ttsc",
      "lib",
      "plugin",
      "loadProjectPlugins.js",
    ),
  );
  const previousPath = process.env.PATH;
  const previousCacheDir = process.env.TTSC_CACHE_DIR;
  process.env.PATH = goPath();
  process.env.TTSC_CACHE_DIR = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-lint-future-flag-"),
  );
  let loaded;
  try {
    loaded = loadProjectPlugins({
      binary: nativeBinary,
      cwd: root,
      tsconfig: path.join(root, "tsconfig.json"),
    });
  } finally {
    process.env.PATH = previousPath;
    if (previousCacheDir === undefined) {
      delete process.env.TTSC_CACHE_DIR;
    } else {
      process.env.TTSC_CACHE_DIR = previousCacheDir;
    }
  }
  const loadedBinary = loaded.nativePlugins[0]?.binary;
  assert.equal(typeof loadedBinary, "string");
  const pluginsJson = JSON.stringify(
    loaded.nativePlugins.map((plugin) => ({
      config: plugin.config,
      name: plugin.name,
      stage: plugin.stage,
    })),
  );

  const result = spawn(
    loadedBinary,
    [
      "check",
      "--cwd",
      root,
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      "--plugins-json",
      pluginsJson,
      "--future-optional-flag",
      "ignored-value",
    ],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("plugin corpus: @ttsc/lint option changes reuse the source plugin binary cache", () => {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "cache-options";\n`,
  );
  const writeConfig = (config) => {
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          plugins: [{ transform: "@ttsc/lint", config }],
        },
        include: ["src"],
      }),
    );
  };
  const cacheDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-lint-cache-options-"),
  );
  const env = { PATH: goPath(), TTSC_CACHE_DIR: cacheDir };

  writeConfig({ "no-var": "error" });
  const first = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env,
  });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stderr, /building source plugin "@ttsc\/lint"/);

  writeConfig({ "no-explicit-any": "warning", "prefer-template": "warning" });
  const second = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--outDir", "custom"],
    {
      cwd: root,
      env,
    },
  );
  assert.equal(second.status, 0, second.stderr);
  assert.doesNotMatch(second.stderr, /building source plugin "@ttsc\/lint"/);
  assert.equal(fs.existsSync(path.join(root, "custom", "main.js")), true);

  const pluginCache = path.join(cacheDir, "plugins");
  const entries = fs
    .readdirSync(pluginCache, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith("scratch-"),
    );
  assert.equal(entries.length, 1);
});

test("plugin corpus: source plugin default cache is project-local under node_modules", () => {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "local-cache";\n`,
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
        plugins: [{ transform: "@ttsc/lint", config: { "no-var": "error" } }],
      },
      include: ["src"],
    }),
  );

  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: { PATH: goPath() },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);

  const pluginCache = path.join(root, "node_modules", ".ttsc", "plugins");
  const entries = fs
    .readdirSync(pluginCache, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith("scratch-"),
    );
  assert.equal(entries.length, 1);
  assert.equal(
    fs.existsSync(
      path.join(
        pluginCache,
        entries[0].name,
        process.platform === "win32" ? "plugin.exe" : "plugin",
      ),
    ),
    true,
  );
  assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
});

test("plugin corpus: @ttsc/lint reports unknown rule names", () => {
  const root = setupLintProject("lint-violations");
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
          {
            transform: "@ttsc/lint",
            config: {
              "made-up-rule": "error",
            },
          },
        ],
      },
      include: ["src"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "ok";\n`,
  );
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-unknown-"));
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /ignoring unknown rule "made-up-rule"/);
});

// parseExpectations reads `// expect: <rule> <severity>` annotations and
// returns the line each one anchors to (the next non-comment, non-blank
// line after the annotation).
function parseExpectations(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const expected = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /\/\/\s*expect:\s*([\w-]+)\s+(error|warn)\s*$/,
    );
    if (!match) continue;
    const [, rule, severity] = match;
    let target = i + 1;
    while (
      target < lines.length &&
      (/^\s*$/.test(lines[target]) || /^\s*\/\//.test(lines[target]))
    ) {
      target++;
    }
    if (target < lines.length) {
      expected.push({ rule, severity, line: target + 1 });
    }
  }
  return expected;
}

// parseDiagnostics turns the renderer's stderr into structured records
// for the given file. Strips ANSI color escapes before matching since
// pretty diagnostics are colored when stdout is a TTY.
//
// The renderer uses the `path:LINE:COL - <category> TS<code>: <msg>`
// shape — same one tsgo's `tsc --noEmit` prints.
function parseDiagnostics(stderr, filePath) {
  const ansi = /\x1b\[[0-9;]*[A-Za-z]/g;
  const stripped = stderr.replace(ansi, "");
  const lines = stripped.split(/\r?\n/);
  const fileBase = path.basename(filePath).replace(/\./g, "\\.");
  const banner = new RegExp(
    `(?:^|[\\s/])[^\\s:]*${fileBase}:(\\d+):(\\d+)\\s+-\\s+(error|warning)\\s+TS\\d+:\\s*\\[([\\w-]+)\\]`,
  );
  const out = [];
  for (const line of lines) {
    const match = line.match(banner);
    if (!match) continue;
    const [, lineNo, , category, rule] = match;
    out.push({
      rule,
      severity: category === "warning" ? "warn" : "error",
      line: parseInt(lineNo, 10),
    });
  }
  return out;
}

// setupLintProject copies a project fixture out to a tempdir and seeds a
// `node_modules/@ttsc/lint` symlink pointing at the workspace package, so
// `require("@ttsc/lint")` resolves the same way it would for a published
// install. Using a real symlink (instead of writing a relay file) keeps the
// plugin's `__dirname` pointed at the workspace go-plugin source dir.
function setupLintProject(name) {
  const root = copyProject(name);
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  const target = path.join(workspaceRoot, "packages", "lint");
  const link = path.join(linkDir, "lint");
  try {
    fs.symlinkSync(target, link, "junction");
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
  return root;
}

function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

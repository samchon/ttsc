const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  commonJsProject,
  copyProject,
  createProject,
  runNode,
  spawn,
  ttscBin,
  workspaceRoot,
} = require("./_helpers.cjs");

const utilityPackages = ["lint", "banner", "paths", "strip"];

test("utility plugins: descriptors own separate native source directories", () => {
  const expectations = {
    lint: ["ttsc-lint", ["check"]],
    banner: "ttsc-banner",
    paths: "ttsc-paths",
    strip: "ttsc-strip",
  };
  const seenDirs = new Set();
  for (const [name, expectation] of Object.entries(expectations)) {
    const [mode, capabilities] = Array.isArray(expectation)
      ? expectation
      : [expectation, ["output"]];
    const mod = require(path.join(workspaceRoot, "packages", name));
    const factory = mod.createTtscPlugin ?? mod.default ?? mod;
    const descriptor = factory(factoryContext(name));
    assert.equal(descriptor.name, `@ttsc/${name}`);
    assert.equal(descriptor.native.mode, mode);
    assert.equal(descriptor.native.contractVersion, 1);
    assert.deepEqual(descriptor.native.capabilities, capabilities);
    assert.equal(
      descriptor.native.source.dir,
      path.join(workspaceRoot, "packages", name),
    );
    assert.equal(descriptor.native.source.entry, "./plugin");
    assert.equal(
      fs.existsSync(path.join(descriptor.native.source.dir, "go.mod")),
      true,
    );
    seenDirs.add(descriptor.native.source.dir);
  }
  assert.equal(seenDirs.size, 4);
});

function factoryContext(name) {
  return {
    binary: "",
    cwd: workspaceRoot,
    plugin: { transform: `@ttsc/${name}` },
    projectRoot: workspaceRoot,
    tsconfig: path.join(workspaceRoot, "tsconfig.json"),
  };
}

test("utility plugins: lint, banner, paths, and strip run together in ttsc build", () => {
  const root = copyProject("utility-plugins");
  seedUtilityPackages(root);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-utility-combo-")),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);
  assert.match(result.stderr, /building source plugin "@ttsc\/banner"/);
  assert.match(result.stderr, /building source plugin "@ttsc\/paths"/);
  assert.match(result.stderr, /building source plugin "@ttsc\/strip"/);

  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /^\/\*! utility combo \*\//);
  assert.match(js, /require\("\.\/modules\/join\.js"\)/);
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /console\.(?:log|debug)/);
  assert.doesNotMatch(js, /\bdebugger\b/);
  assert.doesNotMatch(js, /assert\.equal/);

  const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "hello:ok");
});

test("utility plugins: output plugins run sequentially in ttsc transform", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `console.log("drop");\nexport const value: string = "transform";\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/banner",
            banner: "/*! transform banner */",
          },
          {
            transform: "@ttsc/strip",
            calls: ["console.log"],
          },
        ],
      },
    },
  );
  seedUtilityPackages(root, ["banner", "strip"]);
  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts"],
    {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-utility-transform-")),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\/\*! transform banner \*\//);
  assert.doesNotMatch(result.stdout, /console\.log/);
  assert.match(result.stdout, /"transform"/);
});

test("utility plugins: banner prepends JavaScript and declaration outputs", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
        plugins: [
          {
            transform: "@ttsc/banner",
            banner: "/*! banner-only */",
          },
        ],
      },
    },
  );
  seedUtilityPackages(root, ["banner"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-utility-banner-")),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"), /^\/\*! banner-only \*\//);
  assert.match(fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8"), /^\/\*! banner-only \*\//);
});

test("utility plugins: paths rewrites ESM imports and re-exports", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        declaration: true,
        strict: true,
        paths: {
          "@lib/exact": ["./src/modules/exact.ts"],
          "@lib/*": ["./src/missing/*", "./src/modules/*"],
        },
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/paths" }],
      },
      include: ["src"],
    }),
    "src/modules/exact.ts": `export const exact = "exact" as const;\n`,
    "src/modules/message.ts": `export interface MessageBox { value: string }\nexport const message = "paths";\n`,
    "src/main.ts": [
      `import { message } from "@lib/message";`,
      `import { exact } from "@lib/exact";`,
      `export { message } from "@lib/message";`,
      `export type { MessageBox } from "@lib/message";`,
      `export type ImportedBox = import("@lib/message").MessageBox;`,
      `export const value = message + ":" + exact;`,
      `export async function loadMessage(): Promise<string> {`,
      `  return (await import("@lib/message")).message;`,
      `}`,
      ``,
    ].join("\n"),
  });
  seedUtilityPackages(root, ["paths"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-utility-paths-")),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /from "\.\/modules\/exact\.js"/);
  assert.match(js, /from "\.\/modules\/message\.js"/);
  assert.match(js, /import\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /@lib\/message/);
  assert.doesNotMatch(js, /@lib\/exact/);
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  assert.match(dts, /from "\.\/modules\/message\.js"/);
  assert.match(dts, /import\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(dts, /@lib\/message/);
});

test("utility plugins: strip removes configured calls and debugger statements", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `const assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };\ndebugger;\nconsole.log("drop");\nconsole.debug("drop");\nassert.equal(1, 1);\nconsole.info("kept");\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/strip",
            calls: ["console.log", "console.debug", "assert.*"],
            statements: ["debugger"],
          },
        ],
      },
    },
  );
  seedUtilityPackages(root, ["strip"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-utility-strip-")),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.doesNotMatch(js, /console\.(?:log|debug)/);
  assert.doesNotMatch(js, /\bdebugger\b/);
  assert.doesNotMatch(js, /assert\.equal/);
  assert.match(js, /console\.info\("kept"\)/);
  const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "kept");
});

function seedUtilityPackages(root, names = utilityPackages) {
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  for (const name of names) {
    const target = path.join(workspaceRoot, "packages", name);
    const link = path.join(linkDir, name);
    try {
      fs.symlinkSync(target, link, "junction");
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  }
}

function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

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
    lint: "check",
    banner: "transform",
    paths: "transform",
    strip: "transform",
  };
  const seenDirs = new Set();
  for (const [name, stage] of Object.entries(expectations)) {
    const mod = require(path.join(workspaceRoot, "packages", name));
    const factory = mod.createTtscPlugin ?? mod.default ?? mod;
    const descriptor = factory(factoryContext(name));
    assert.equal(descriptor.name, `@ttsc/${name}`);
    assert.equal(descriptor.stage, stage);
    assert.deepEqual(Object.keys(descriptor).sort(), [
      "name",
      "source",
      "stage",
    ]);
    assert.equal(
      descriptor.source,
      path.join(workspaceRoot, "packages", name, "plugin"),
    );
    assert.equal(
      fs.existsSync(path.join(workspaceRoot, "packages", name, "go.mod")),
      true,
    );
    seenDirs.add(descriptor.source);
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
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-utility-combo-"),
      ),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);
  assert.match(result.stderr, /building source plugin "@ttsc\/banner"/);
  assert.match(result.stderr, /building source plugin "@ttsc\/paths"/);
  assert.match(result.stderr, /building source plugin "@ttsc\/strip"/);

  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, bannerPreamble("utility combo"));
  assert.match(js, /require\("\.\/modules\/join\.js"\)/);
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /console\.(?:log|debug)/);
  assert.doesNotMatch(js, /\bdebugger\b/);
  assert.doesNotMatch(js, /assert\.equal/);

  const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "hello:ok");

  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  assert.match(dts, bannerPreamble("utility combo"));
  assert.match(dts, /import\("\.\/modules\/join\.js"\)/);
  assert.match(dts, /import\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(dts, /@lib\/join|exact-message/);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8"))
      .version,
    3,
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(root, "dist", "main.d.ts.map"), "utf8"),
    ).version,
    3,
  );
});

test("utility plugins: shared transform host works when paths is first", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        declaration: true,
        strict: true,
        paths: {
          "@lib/*": ["./src/modules/*"],
        },
        outDir: "dist",
        rootDir: "src",
        plugins: [
          { transform: "@ttsc/paths" },
          { transform: "@ttsc/banner", banner: "paths first" },
          {
            transform: "@ttsc/strip",
            calls: ["console.log"],
            statements: ["debugger"],
          },
        ],
      },
      include: ["src"],
    }),
    "src/modules/message.ts": `export const message = "ok";\n`,
    "src/main.ts": [
      `import { message } from "@lib/message";`,
      `console.log("drop");`,
      `debugger;`,
      `export const value = message;`,
      ``,
    ].join("\n"),
  });
  seedUtilityPackages(root, ["banner", "paths", "strip"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-utility-paths-first-"),
      ),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  assert.match(js, bannerPreamble("paths first"));
  assert.match(dts, bannerPreamble("paths first"));
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /@lib\/message|console\.log|\bdebugger\b/);
});

test("utility plugins: banner injects JavaScript and declaration JSDoc", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        plugins: [
          {
            transform: "@ttsc/banner",
            banner: "banner-only\nsecond line",
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
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-utility-banner-"),
      ),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  const jsMap = fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8");
  const dtsMap = fs.readFileSync(
    path.join(root, "dist", "main.d.ts.map"),
    "utf8",
  );
  assert.match(js, bannerPreamble("banner-only\nsecond line"));
  assert.match(dts, bannerPreamble("banner-only\nsecond line"));
  assert.match(js, /\n\/\/# sourceMappingURL=main\.js\.map$/);
  assert.match(dts, /\n\/\/# sourceMappingURL=main\.d\.ts\.map$/);
  assert.doesNotMatch(jsMap, /@packageDocumentation|banner-only/);
  assert.doesNotMatch(dtsMap, /@packageDocumentation|banner-only/);
  assert.equal(JSON.parse(jsMap).version, 3);
  assert.equal(JSON.parse(dtsMap).version, 3);
});

test("utility plugins: banner follows removeComments", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
        removeComments: true,
        plugins: [
          {
            transform: "@ttsc/banner",
            banner: "removed banner",
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
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-utility-banner-remove-comments-"),
      ),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
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
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-utility-paths-"),
      ),
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
      "src/main.ts": `export interface StripBox { value: string }\nconst assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };\ndebugger;\nconsole.log("drop");\nconsole.debug("drop");\nassert.equal(1, 1);\nconsole.info("kept");\nexport const box: StripBox = { value: "kept" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
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
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-utility-strip-"),
      ),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.doesNotMatch(js, /console\.(?:log|debug)/);
  assert.doesNotMatch(js, /\bdebugger\b/);
  assert.doesNotMatch(js, /assert\.equal/);
  assert.match(js, /console\.info\("kept"\)/);
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  assert.match(dts, /interface StripBox/);
  assert.match(dts, /value: string/);
  assert.doesNotMatch(dts, /console|debugger|assert/);
  const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "kept");
});

test("utility plugins: removed output stage descriptor is rejected", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `export const value = "x";\n`,
      "plugins/output.cjs": `
        module.exports = {
          name: "legacy-output",
          source: require("node:path").resolve(__dirname, "..", "plugin"),
          stage: "output",
        };
      `,
      "plugin/go.mod": "module example.com/legacyoutput\n\ngo 1.26\n",
      "plugin/main.go": "package main\n\nfunc main() {}\n",
    },
    {
      compilerOptions: {
        plugins: [{ transform: "./plugins/output.cjs" }],
      },
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /removed stage "output"/);
});

test("utility plugins: legacy-named user options remain plugin config", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `export const value = "x";\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/banner",
            banner: "phase",
            after: true,
            before: true,
            phase: "custom-plugin-config",
          },
        ],
      },
    },
  );
  seedUtilityPackages(root, ["banner"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /phase/);
});

test("utility plugins: first-party aggregate requires package identity", () => {
  const root = commonJsProject(
    {
      "src/main.ts": `export const value = "x";\n`,
      "plugins/fake-banner.cjs": `
        module.exports = {
          name: "@ttsc/banner",
          source: require("node:path").resolve(__dirname, "..", "fake-banner"),
          stage: "transform",
        };
      `,
      "plugins/fake-strip.cjs": `
        module.exports = {
          name: "@ttsc/strip",
          source: require("node:path").resolve(__dirname, "..", "fake-strip"),
          stage: "transform",
        };
      `,
      "fake-banner/go.mod": "module example.com/fakebanner\n\ngo 1.26\n",
      "fake-banner/main.go": "package main\n\nfunc main() {}\n",
      "fake-strip/go.mod": "module example.com/fakestrip\n\ngo 1.26\n",
      "fake-strip/main.go": "package main\n\nfunc main() {}\n",
    },
    {
      compilerOptions: {
        plugins: [
          { transform: "./plugins/fake-banner.cjs" },
          { transform: "./plugins/fake-strip.cjs" },
        ],
      },
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-utility-fake-first-party-"),
      ),
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /multiple compiler native backends cannot share one emit pass/,
  );
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

function bannerPreamble(text) {
  const lines = text.split(/\r?\n/).filter((line, index, all) => {
    return index < all.length - 1 || line.trim() !== "";
  });
  const sep = "-".repeat(64);
  const escaped = [
    "/**",
    ` * ${sep}`,
    ...lines.map((line) => ` * ${line.replaceAll("*/", "* /")}`),
    " *",
    " * @packageDocumentation",
    " */",
  ]
    .map(escapeRegExp)
    .join("\\n");
  return new RegExp(`${escaped}\\n`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

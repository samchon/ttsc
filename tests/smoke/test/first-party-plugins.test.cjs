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

const firstPartyPackages = ["lint", "banner", "alias", "strip"];

test("first-party plugins: descriptors share one native source host", () => {
  const lintFactory = require(path.join(workspaceRoot, "packages", "lint"));
  const sharedDir = lintFactory({}, {}).native.source.dir;
  const expectations = {
    alias: "ttsc-alias",
    banner: "ttsc-banner",
    strip: "ttsc-strip",
  };
  for (const [name, mode] of Object.entries(expectations)) {
    const factory = require(path.join(workspaceRoot, "packages", name));
    const descriptor = factory({}, {});
    assert.equal(descriptor.name, `@ttsc/${name}`);
    assert.equal(descriptor.native.mode, mode);
    assert.equal(descriptor.native.contractVersion, 1);
    assert.equal(descriptor.native.source.dir, sharedDir);
  }
});

test("first-party plugins: lint, banner, alias, and strip run together in ttsc build", () => {
  const root = copyProject("first-party-plugins");
  seedFirstPartyPackages(root);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-first-party-combo-")),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);

  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /^\/\*! first-party combo \*\//);
  assert.match(js, /require\("\.\/modules\/join\.js"\)/);
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /console\.(?:log|debug)/);
  assert.doesNotMatch(js, /\bdebugger\b/);
  assert.doesNotMatch(js, /assert\.equal/);

  const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "hello:ok");
});

test("first-party plugins: banner prepends JavaScript and declaration outputs", () => {
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
  seedFirstPartyPackages(root, ["lint", "banner"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-first-party-banner-")),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"), /^\/\*! banner-only \*\//);
  assert.match(fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8"), /^\/\*! banner-only \*\//);
});

test("first-party plugins: alias rewrites ESM imports and re-exports", () => {
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
        plugins: [{ transform: "@ttsc/alias" }],
      },
      include: ["src"],
    }),
    "src/modules/exact.ts": `export const exact = "exact" as const;\n`,
    "src/modules/message.ts": `export interface MessageBox { value: string }\nexport const message = "alias";\n`,
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
  seedFirstPartyPackages(root, ["lint", "alias"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-first-party-alias-")),
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

test("first-party plugins: strip removes configured calls and debugger statements", () => {
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
  seedFirstPartyPackages(root, ["lint", "strip"]);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-first-party-strip-")),
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

function seedFirstPartyPackages(root, names = firstPartyPackages) {
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

const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "../../..");
const testPackageRoot = path.resolve(__dirname, "..");
const ttscBin = path.join(
  testPackageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "ttsc.cmd" : "ttsc",
);
const ttsxBin = path.join(
  testPackageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "ttsx.cmd" : "ttsx",
);
const nativeBinary = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "native",
  process.platform === "win32" ? "ttsc-native.exe" : "ttsc-native",
);

test("ttsc reports the native version banner", () => {
  const result = spawn(ttscBin, ["--version"], { cwd: workspaceRoot });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ttsc /);
  assert.match(result.stdout, /go /);
});

test("ttsc builds a plain TypeScript project without typia", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const add = (x: number, y: number): number => x + y;\nconsole.log(add(2, 3));\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /exports\.add/);

  const run = spawn(process.execPath, [path.join(root, "dist", "main.js")], {
    cwd: root,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "5");
});

test("ttsc JS plugin transformOutput composes with native emit", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "./plugins/banner.cjs", label: "smoke" }],
      },
      include: ["src"],
    }),
    "plugins/banner.cjs": `
      const { definePlugin } = require("ttsc");
      module.exports = definePlugin((config) => ({
        name: "banner",
        transformOutput(context) {
          return "// plugin:" + config.label + ":" + context.command + "\\n" + context.code;
        },
      }));
    `,
    "src/main.ts": `export const value: string = "ok";\n`,
  });

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", path.join(root, "src/main.ts")],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\/\/ plugin:smoke:transform\n/);
  assert.match(result.stdout, /exports\.value/);
});

test("ttsc blocks semantic diagnostics before emit", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `const value: string = 123;\nconsole.log(value);\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Type 'number' is not assignable to type 'string'/);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
});

test("ttsx runs a CommonJS TypeScript entry through ttsc", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `const message: string = "runner-ok";\nconsole.log(message);\n`,
  });

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "runner-ok");
});

test("local native binary was built for the test run", () => {
  assert.equal(fs.existsSync(nativeBinary), true);
});

function createProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-smoke-"));
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }
  return root;
}

function spawn(command, args, options) {
  return child_process.spawnSync(command, args, {
    ...options,
    env: {
      ...process.env,
      TTSC_BINARY: nativeBinary,
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
    windowsHide: true,
  });
}

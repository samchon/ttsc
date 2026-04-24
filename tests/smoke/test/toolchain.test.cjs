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
      module.exports = (config) => ({
        name: "banner",
        transformOutput(context) {
          return "// plugin:" + config.label + ":" + context.command + "\\n" + context.code;
        },
      });
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

test("ttsc build applies chained plugins and skips disabled plugin entries", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [
          { transform: "./plugins/first.cjs", label: "first" },
          { transform: "./plugins/disabled.cjs", enabled: false },
          { transform: "./plugins/second.cjs" },
        ],
      },
      include: ["src"],
    }),
    "plugins/first.cjs": `
      module.exports = (config) => ({
        name: "first",
        transformOutput(context) {
          return context.code + "\\n// " + config.label + ":" + context.command;
        },
      };
    `,
    "plugins/second.cjs": `
      exports.plugin = {
        name: "second",
        transformOutput(context) {
          return context.code + "\\n// second:" + context.command;
        },
      };
    `,
    "plugins/disabled.cjs": `
      module.exports = {
        name: "disabled",
        transformOutput(context) {
          return context.code + "\\n// disabled";
        },
      };
    `,
    "src/main.ts": `export const value: string = "chain";\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /\/\/ first:build\n\/\/ second:build\s*$/);
  assert.doesNotMatch(js, /disabled/);
});

test("ttsc transform writes --out and honors auto-detected jsconfig", () => {
  const root = createProject({
    "jsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const answer: number = 42;\n`,
  });
  const out = path.join(root, "out", "main.js");

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts", "--out", out],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(out, "utf8");
  assert.match(js, /exports\.answer/);
});

test("ttsc check resolves paths mappings under current TypeScript-Go policy", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        paths: {
          "@lib/*": ["./lib/*"],
          "exact-lib": ["./lib/exact.ts"],
        },
      },
      include: ["src", "lib"],
    }),
    "lib/exact.ts": `export const exact = "exact" as const;\n`,
    "lib/tool.ts": `export const tool = "tool" as const;\n`,
    "src/main.ts": `
      import { exact } from "exact-lib";
      import { tool } from "@lib/tool";
      export const joined: string = exact + ":" + tool;
    `,
  });

  const result = spawn(ttscBin, ["check", "--cwd", root], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
});

test("ttsc emits declaration files when the project requests them", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        declaration: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export interface Box<T> { value: T }\nexport const box = <T>(value: T): Box<T> => ({ value });\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.d.ts")), true);
});

test("ttsc programmatic transformAsync uses the resolved native binary", async () => {
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
    "src/main.ts": `export const value: string = "api";\n`,
  });
  const { transformAsync } = require("ttsc");

  const js = await transformAsync({
    binary: nativeBinary,
    cwd: root,
    file: path.join(root, "src", "main.ts"),
  });
  assert.match(js, /exports\.value/);
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

test("ttsc reports bind diagnostics through the tsgo diagnostic pipeline", () => {
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
    "src/main.ts": `let value = 1;\nlet value = 2;\nconsole.log(value);\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot redeclare block-scoped variable 'value'/);
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

test("ttsx forwards argv after -- and runs preload modules", () => {
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
    "preload.cjs": `globalThis.__ttsxPreload = "loaded";\n`,
    "src/main.ts": `
      declare const process: { argv: string[] };
      console.log(JSON.stringify({
        preload: (globalThis as any).__ttsxPreload,
        argv: process.argv.slice(2),
      }));
    `,
  });

  const result = spawn(
    ttsxBin,
    ["--cwd", root, "-r", "./preload.cjs", "src/main.ts", "--", "--flag", "value"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    preload: "loaded",
    argv: ["--flag", "value"],
  });
});

test("ttsx runs an ESM TypeScript entry through the emitted project path", () => {
  const root = createProject({
    "package.json": JSON.stringify({ type: "module" }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/helper.ts": `export const message: string = "esm-runner-ok";\n`,
    "src/main.ts": `import { message } from "./helper";\nconsole.log(message);\n`,
  });

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "esm-runner-ok");
});

test("ttsx runs an .mts entry and resolves emitted .mjs imports", () => {
  const root = createProject({
    "package.json": JSON.stringify({ type: "module" }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/helper.mts": `export const message: string = "mts-runner-ok";\n`,
    "src/main.mts": `import { message } from "./helper.mjs";\nconsole.log(message);\n`,
  });

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.mts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "mts-runner-ok");
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

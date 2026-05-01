const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "../../..");
const ttscBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const ttsxBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsx.js",
);
const nativeBinary = path.join(
  workspaceRoot,
  "packages",
  `ttsc-${process.platform}-${process.arch}`,
  "bin",
  process.platform === "win32" ? "ttsc.exe" : "ttsc",
);
const tsgoBinary = resolveTsgoBinary();

test("ttsc reports the consumer tsgo version banner", () => {
  const result = spawn(ttscBin, ["--version"], { cwd: workspaceRoot });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ttsc /);
  assert.match(result.stdout, /Version 7\.0\.0-dev\./);
});

test("ttsx executes JavaScript emitted by the consumer-local tsgo", () => {
  const root = createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        outDir: "dist",
        rootDir: ".",
      },
      include: ["src"],
    }),
    "src/index.ts": `console.log("source-should-not-run");\n`,
  });
  const logFile = path.join(root, "tsgo.log");
  createFakeNativePreview(
    root,
    `
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, args.join(" ") + "\\n");
if (args.includes("--version")) {
  console.log("Version 7.0.0-dev.CONSUMER-SMOKE");
  process.exit(0);
}
const noEmitAt = args.indexOf("--noEmit");
const noEmit = noEmitAt >= 0 && args[noEmitAt + 1] !== "false";
if (!noEmit) {
  const outDirAt = args.indexOf("--outDir");
  const outDir = outDirAt >= 0 ? args[outDirAt + 1] : path.join(${JSON.stringify(root)}, "dist");
  const out = path.join(outDir, "src", "index.js");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, "console.log(\\"consumer-local-tsgo\\");\\n", "utf8");
}
`,
  );

  const result = spawnWithoutTsgoOverride(ttsxBin, ["src/index.ts"], {
    cwd: root,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "consumer-local-tsgo");
  assert.match(fs.readFileSync(logFile, "utf8"), /--outDir/);
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
    "src/main.ts": `export const add = (x: number, y: number): number => x + y;\nconsole.log(add(2, 3).toString());\n`,
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

test("ttsc rejects unsupported transform command", () => {
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

  const result = spawn(ttscBin, ["transform", "--cwd", root], { cwd: root });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command "transform"/);
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
  assert.match(
    result.stderr,
    /Type 'number' is not assignable to type 'string'/,
  );
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
    [
      "--cwd",
      root,
      "-r",
      "./preload.cjs",
      "src/main.ts",
      "--",
      "--flag",
      "value",
    ],
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

test("ttsx rewrites extensionless ESM side-effect imports", () => {
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
    "src/setup.ts": `
      export {};
      declare global { var __ttsxSideEffect: string | undefined; }
      globalThis.__ttsxSideEffect = "side-effect-import-ok";
    `,
    "src/main.ts": `import "./setup";\nconsole.log(globalThis.__ttsxSideEffect);\n`,
  });

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "side-effect-import-ok");
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

test("current platform package binary was built for the test run", () => {
  assert.equal(fs.existsSync(nativeBinary), true);
  assert.ok(
    fs.statSync(nativeBinary).size < 5 * 1024 * 1024,
    "platform helper should stay below 5MB",
  );

  const result = child_process.spawnSync(nativeBinary, ["--version"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ttsc platform helper /);
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
  const usesNodeLauncher = command === ttscBin || command === ttsxBin;
  const result = child_process.spawnSync(
    usesNodeLauncher ? process.execPath : command,
    [...(usesNodeLauncher ? [command] : []), ...args],
    {
      ...options,
      env: {
        ...process.env,
        TTSC_BINARY: nativeBinary,
        TTSC_TSGO_BINARY: tsgoBinary,
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    },
  );
  if (result.error && !result.stderr) {
    result.stderr = result.error.message;
  }
  return result;
}

function spawnWithoutTsgoOverride(command, args, options) {
  const usesNodeLauncher = command === ttscBin || command === ttsxBin;
  const env = { ...process.env };
  delete env.TTSC_BINARY;
  delete env.TTSC_TSGO_BINARY;
  const result = child_process.spawnSync(
    usesNodeLauncher ? process.execPath : command,
    [...(usesNodeLauncher ? [command] : []), ...args],
    {
      ...options,
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    },
  );
  if (result.error && !result.stderr) {
    result.stderr = result.error.message;
  }
  return result;
}

function createFakeNativePreview(root, scriptBody) {
  const nativeRoot = path.join(
    root,
    "node_modules",
    "@typescript",
    "native-preview",
  );
  const platformRoot = path.join(
    root,
    "node_modules",
    "@typescript",
    `native-preview-${process.platform}-${process.arch}`,
  );
  fs.mkdirSync(nativeRoot, { recursive: true });
  fs.mkdirSync(path.join(platformRoot, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(nativeRoot, "package.json"),
    JSON.stringify({
      name: "@typescript/native-preview",
      version: "7.0.0-dev.CONSUMER-SMOKE",
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(platformRoot, "package.json"),
    JSON.stringify({
      name: `@typescript/native-preview-${process.platform}-${process.arch}`,
      version: "7.0.0-dev.CONSUMER-SMOKE",
    }),
    "utf8",
  );
  const tsgo = path.join(
    platformRoot,
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
  fs.writeFileSync(
    tsgo,
    `#!/usr/bin/env node\nconst fs = require("node:fs");\nconst path = require("node:path");\n${scriptBody}\n`,
    "utf8",
  );
  fs.chmodSync(tsgo, 0o755);
}

function resolveTsgoBinary() {
  const packageJson = require.resolve(
    "@typescript/native-preview/package.json",
    {
      paths: [workspaceRoot],
    },
  );
  const requireFromNativePreview = createRequire(packageJson);
  const platformPackageJson = requireFromNativePreview.resolve(
    `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
}

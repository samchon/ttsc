const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  commonJsProject,
  createProject,
  spawn,
  ttsxBin,
} = require("./_helpers.cjs");

test("runner corpus: .cts entry executes through CommonJS output", () => {
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
    "src/main.cts": `const message: string = "cts-runner-ok";\nconsole.log(message);\n`,
  });

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.cts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "cts-runner-ok");
});

test("runner corpus: nested entry discovers nearest package tsconfig", () => {
  const root = createProject({
    "packages/app/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "packages/app/src/main.ts": `const message: string = "nested-tsconfig-ok";\nconsole.log(message);\n`,
  });

  const result = spawn(ttsxBin, ["--cwd", root, "packages/app/src/main.ts"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "nested-tsconfig-ok");
});

test("runner corpus: explicit project option overrides entry discovery", () => {
  const root = createProject({
    "configs/app.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "../dist",
        rootDir: "../src",
      },
      include: ["../src"],
    }),
    "src/main.ts": `const message: string = "explicit-runner-project";\nconsole.log(message);\n`,
  });

  const result = spawn(
    ttsxBin,
    ["--cwd", root, "--project", "configs/app.json", "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "explicit-runner-project");
});

test("runner corpus: ttsx executes the intended entrypoint and side effects", () => {
  const root = commonJsProject({
    "src/main.ts": `
      declare const process: {
        argv: string[];
        cwd(): string;
        env: { TTSX_MARKER?: string };
      };
      declare function require(name: string): {
        writeFileSync(file: string, text: string): void;
      };

      const fs = require("node:fs");
      const marker = process.env.TTSX_MARKER;
      if (!marker) throw new Error("missing marker path");
      fs.writeFileSync(marker, JSON.stringify({
        argv: process.argv.slice(2),
        cwd: process.cwd(),
        executed: true,
      }));
      console.log("ttsx-intended-execution");
    `,
  });
  const marker = path.join(root, "runner-marker.json");

  const result = spawn(
    ttsxBin,
    ["--cwd", root, "src/main.ts", "--", "--mode", "probe"],
    {
      cwd: root,
      env: {
        TTSX_MARKER: marker,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "ttsx-intended-execution");
  assert.deepEqual(JSON.parse(fs.readFileSync(marker, "utf8")), {
    argv: ["--mode", "probe"],
    cwd: root,
    executed: true,
  });
});

test("runner corpus: CommonJS __dirname resolves from configured outDir", () => {
  const root = createProject({
    "app/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "bin",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "app/src/node.d.ts": `
      declare const __dirname: string;
      declare function require(name: string): { readFileSync(file: string, encoding: string): string };
    `,
    "app/src/TestGlobal.ts": `
      export class TestGlobal {
        public static readonly ROOT: string = __dirname + "/..";
      }
    `,
    "app/src/main.ts": `
      import { TestGlobal } from "./TestGlobal";

      const fs = require("node:fs");
      console.log(fs.readFileSync(TestGlobal.ROOT + "/../template/data.txt", "utf8"));
    `,
    "template/data.txt": "dirname-preserved",
  });
  const cwd = path.join(root, "app");

  const result = spawn(ttsxBin, ["--cwd", cwd, "src/main.ts"], { cwd });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "dirname-preserved");
});

test("runner corpus: ESM import.meta.url resolves from configured outDir", () => {
  const root = createProject({
    "app/package.json": JSON.stringify({ type: "module" }),
    "app/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        outDir: "bin",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "app/src/node.d.ts": `
      declare module "node:fs" {
        export function readFileSync(file: string, encoding: string): string;
      }
      declare module "node:path" {
        export function dirname(file: string): string;
        export function resolve(...parts: string[]): string;
      }
      declare module "node:url" {
        export function fileURLToPath(url: string): string;
      }
    `,
    "app/src/global.ts": `
      import path from "node:path";
      import { fileURLToPath } from "node:url";

      export const ROOT = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
      );
    `,
    "app/src/main.ts": `
      import fs from "node:fs";
      import { ROOT } from "./global";

      console.log(fs.readFileSync(ROOT + "/../template/data.txt", "utf8"));
    `,
    "template/data.txt": "import-meta-preserved",
  });
  const cwd = path.join(root, "app");

  const result = spawn(ttsxBin, ["--cwd", cwd, "src/main.ts"], { cwd });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "import-meta-preserved");
});

test("runner corpus: ttsx keeps configured outDir untouched", () => {
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
    "dist/keep.txt": "do-not-delete",
    "src/helper.ts": `export const message: string = "cache-only-run";\n`,
    "src/main.ts": `import { message } from "./helper";\nconsole.log(message);\n`,
  });
  const cacheDir = path.join(root, ".ttsx-cache");

  const result = spawn(
    ttsxBin,
    ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "cache-only-run");
  assert.equal(fs.readFileSync(path.join(root, "dist", "keep.txt"), "utf8"), "do-not-delete");
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  assert.equal(fs.existsSync(path.join(root, "dist", "package.json")), false);
  assert.equal(fs.existsSync(path.join(cacheDir, "project")), true);
});

test("runner corpus: CommonJS __dirname resolves without configured outDir", () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/node.d.ts": `
      declare const __dirname: string;
      declare function require(name: string): { readFileSync(file: string, encoding: string): string };
    `,
    "src/main.ts": `
      const fs = require("node:fs");
      console.log(fs.readFileSync(__dirname + "/../template/data.txt", "utf8"));
    `,
    "template/data.txt": "no-outdir-preserved",
  });

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "no-outdir-preserved");
  assert.equal(fs.existsSync(path.join(root, "src", "main.js")), false);
});

test("runner corpus: type-check diagnostics prevent entry execution", () => {
  const root = commonJsProject({
    "src/main.ts": `
      declare const process: { env: { TTSX_MARKER?: string } };
      declare function require(name: string): {
        writeFileSync(file: string, text: string): void;
      };

      const fs = require("node:fs");
      const marker = process.env.TTSX_MARKER;
      if (!marker) throw new Error("missing marker path");
      fs.writeFileSync(marker, "executed");
      const message: string = 123;
      console.log("should-not-run", message);
    `,
  });
  const marker = path.join(root, "type-error-marker.txt");

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
    cwd: root,
    env: {
      TTSX_MARKER: marker,
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /project check failed/);
  assert.match(result.stderr, /Type 'number' is not assignable to type 'string'/);
  assert.doesNotMatch(result.stdout, /should-not-run/);
  assert.equal(fs.existsSync(marker), false);
});

test("runner corpus: invalid tsconfig prevents entry execution", () => {
  const root = createProject({
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,`,
    "src/main.ts": `
      declare const process: { env: { TTSX_MARKER?: string } };
      declare function require(name: string): {
        writeFileSync(file: string, text: string): void;
      };

      const fs = require("node:fs");
      const marker = process.env.TTSX_MARKER;
      if (!marker) throw new Error("missing marker path");
      fs.writeFileSync(marker, "executed");
      console.log("invalid-config-should-not-run");
    `,
  });
  const marker = path.join(root, "invalid-config-marker.txt");

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
    cwd: root,
    env: {
      TTSX_MARKER: marker,
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected end of JSON input|Expected/);
  assert.doesNotMatch(result.stdout, /invalid-config-should-not-run/);
  assert.equal(fs.existsSync(marker), false);
});

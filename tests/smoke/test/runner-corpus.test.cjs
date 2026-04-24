const assert = require("node:assert/strict");
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

test("runner corpus: diagnostics prevent entry execution", () => {
  const root = commonJsProject({
    "src/main.ts": `const message: string = 123;\nconsole.log("should-not-run", message);\n`,
  });

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /project check failed/);
  assert.doesNotMatch(result.stdout, /should-not-run/);
});

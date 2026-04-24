const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  commonJsProject,
  createProject,
  runNode,
  spawn,
  ttscBin,
} = require("./_helpers.cjs");

const compilerProjects = [
  {
    name: "single file compatibility mode writes to explicit outDir",
    root: () =>
      commonJsProject({
        "src/main.ts": `export const value: number = 7;\nconsole.log(value);\n`,
      }),
    run(root) {
      const result = spawn(ttscBin, ["--cwd", root, "--outDir", "single", "src/main.ts"], {
        cwd: root,
      });
      assert.equal(result.status, 0, result.stderr);
      const output = path.join(root, "single", "src", "main.js");
      assert.equal(fs.existsSync(output), true);
      const run = runNode(output, { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "7");
    },
  },
  {
    name: "explicit project path can live outside cwd root",
    root: () =>
      createProject({
        "configs/tsconfig.app.json": JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            outDir: "../dist/app",
            rootDir: "../src",
          },
          include: ["../src"],
        }),
        "src/main.ts": `export const message: string = "explicit-project";\nconsole.log(message);\n`,
      }),
    run(root) {
      const result = spawn(
        ttscBin,
        ["--cwd", root, "--project", "configs/tsconfig.app.json", "--emit"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        fs.readFileSync(path.join(root, "dist", "app", "main.js"), "utf8").includes("explicit-project"),
        true,
      );
    },
  },
  {
    name: "noEmit mode blocks output writes even when sources are valid",
    root: () =>
      commonJsProject({
        "src/main.ts": `export const value: string = "noemit";\n`,
      }),
    run(root) {
      const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
    },
  },
  {
    name: "emitDeclarationOnly writes declarations without JavaScript",
    root: () =>
      commonJsProject(
        {
          "src/main.ts": `export type Pair = [string, number];\nexport interface Bag { pair: Pair }\n`,
        },
        {
          compilerOptions: {
            declaration: true,
            emitDeclarationOnly: true,
          },
        },
      ),
    run(root) {
      const result = spawn(ttscBin, ["--cwd", root], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(fs.existsSync(path.join(root, "dist", "main.d.ts")), true);
      assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
    },
  },
  {
    name: "sourceMap emits a JavaScript map next to output",
    root: () =>
      commonJsProject(
        {
          "src/main.ts": `export const mapped = () => "map";\n`,
        },
        {
          compilerOptions: {
            sourceMap: true,
          },
        },
      ),
    run(root) {
      const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(fs.existsSync(path.join(root, "dist", "main.js.map")), true);
    },
  },
  {
    name: "syntax diagnostics stop emit before JavaScript is written",
    root: () =>
      commonJsProject({
        "src/main.ts": `export const broken = ;\n`,
      }),
    run(root) {
      const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Expression expected|Declaration or statement expected/);
      assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
    },
  },
  {
    name: "semantic diagnostics stop emit before JavaScript is written",
    root: () =>
      commonJsProject({
        "src/main.ts": `const value: string = 123;\nconsole.log(value);\n`,
      }),
    run(root) {
      const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Type 'number' is not assignable to type 'string'/);
      assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
    },
  },
  {
    name: "invalid tsconfig is rejected before emit",
    root: () =>
      createProject({
        "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,`,
        "src/main.ts": `console.log("invalid-config-should-not-emit");\n`,
      }),
    run(root) {
      const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unexpected end of JSON input|Expected/);
      assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
    },
  },
];

for (const project of compilerProjects) {
  test(`compiler corpus: ${project.name}`, () => {
    const root = project.root();
    project.run(root);
  });
}

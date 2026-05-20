import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies runner corpus: .cts entry executes through CommonJS output.
 *
 * In a `type: "module"` package, `.ts` files are treated as ESM. `.cts` is the
 * explicit CJS override. ttsx must detect the `.cts` extension and load the
 * corresponding `.cjs` emit via `require()` rather than dynamic `import()`.
 *
 * 1. Create a `type: "module"` project with a `.cts` entry.
 * 2. Run ttsx against the `.cts` entry.
 * 3. Assert it exits successfully and prints the expected output.
 */
export const test_runner_corpus_cts_entry_executes_through_commonjs_output =
  () => {
    const root = TestProject.createProject({
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

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.cts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "cts-runner-ok");
  };

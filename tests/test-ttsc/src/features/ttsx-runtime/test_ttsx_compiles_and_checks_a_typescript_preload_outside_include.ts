import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx compiles a TypeScript `--require` preload outside `include`
 * through its project, and stops the run when the preload has a type error.
 *
 * `ttsx` passes `-r` modules to Node's `--require` loader after the runtime
 * hooks are installed, so a `.ts` preload reaches the same lanes as a file the
 * program requires. Outside `include` it is a root no build compiled, and it
 * is checked like one (samchon/ttsc#1382). The documentation used to say that
 * `ttsx` does not compile preload files at all.
 *
 * 1. Create a project with `include: ["src"]` and a `preload.ts` beside the
 *    tsconfig that publishes a value the entry prints.
 * 2. Run the entry with `-r ./preload.ts`, then again after giving the preload a
 *    type error.
 * 3. Assert the first run prints the preloaded value, and the second fails with
 *    the preload's diagnostic before the entry runs.
 */
export const test_ttsx_compiles_and_checks_a_typescript_preload_outside_include =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "preload", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "preload.ts": [
        `const tag: string = "preloaded";`,
        `(globalThis as { tag?: string }).tag = tag;`,
        `export {};`,
        ``,
      ].join("\n"),
      "src/index.ts": [
        `console.log("tag=" + (globalThis as { tag?: string }).tag);`,
        `export {};`,
        ``,
      ].join("\n"),
    });

    const typed = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "-r", "./preload.ts", "src/index.ts"],
      { cwd: root },
    );
    assert.equal(typed.status, 0, typed.stderr);
    assert.equal(typed.stdout.trim(), "tag=preloaded");

    TestProject.writeFiles(root, {
      "preload.ts": [
        `const tag: number = "mistyped";`,
        `(globalThis as { tag?: number }).tag = tag;`,
        `export {};`,
        ``,
      ].join("\n"),
    });
    const mistyped = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "-r", "./preload.ts", "src/index.ts"],
      { cwd: root },
    );
    assert.notEqual(mistyped.status, 0, mistyped.stdout);
    assert.match(mistyped.stderr, /root check failed for .*preload\.ts/);
    assert.match(
      mistyped.stderr,
      /Type 'string' is not assignable to type 'number'/,
    );
    assert.doesNotMatch(mistyped.stdout, /tag=/);
  };

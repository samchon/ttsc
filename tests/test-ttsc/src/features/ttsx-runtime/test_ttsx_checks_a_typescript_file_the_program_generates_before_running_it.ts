import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx compiles and type-checks a TypeScript file the running program
 * writes and then requires.
 *
 * A generated file cannot be in any build that ran before the program started,
 * which puts it in the same state as a file outside `include`: no checked
 * program covered it. It must still run from its own code, compiled through
 * its owning project, and a type error in it must stop the run the same way.
 * Before samchon/ttsc#1382 a generated `index.ts` could run as any emitted
 * `index.js` that happened to share its name.
 *
 * 1. Create a project whose entry writes `generated/value.ts` from an
 *    environment variable and then requires it.
 * 2. Run it with a well-typed source, then with a mistyped one.
 * 3. Assert the first run prints the generated value, and the second fails with
 *    the generated file's diagnostic before printing anything from it.
 */
export const test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "generator", private: true }),
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
      "src/main.ts": [
        `declare const require: (id: string) => any;`,
        `declare const process: { cwd(): string; env: Record<string, string | undefined> };`,
        `const fs = require("node:fs");`,
        `const path = require("node:path");`,
        `const file: string = path.join(process.cwd(), "generated", "value.ts");`,
        `fs.mkdirSync(path.dirname(file), { recursive: true });`,
        `fs.writeFileSync(file, process.env.GENERATED_SOURCE!);`,
        `console.log("value=" + require(file).value);`,
        `export {};`,
        ``,
      ].join("\n"),
    });

    const typed = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          GENERATED_SOURCE: `export const value: string = "generated";\n`,
        },
      },
    );
    assert.equal(typed.status, 0, typed.stderr);
    assert.equal(typed.stdout.trim(), "value=generated");

    const mistyped = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          GENERATED_SOURCE: `export const value: number = "mistyped";\n`,
        },
      },
    );
    assert.notEqual(mistyped.status, 0, mistyped.stdout);
    assert.match(mistyped.stderr, /root check failed for .*value\.ts/);
    assert.match(
      mistyped.stderr,
      /Type 'string' is not assignable to type 'number'/,
    );
    assert.doesNotMatch(mistyped.stdout, /value=/);
  };

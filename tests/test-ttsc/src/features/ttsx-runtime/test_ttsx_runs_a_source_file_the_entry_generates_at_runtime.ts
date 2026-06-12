import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a `.ts` source the entry writes into its own project at
 * runtime, after the up-front build already finished.
 *
 * A program can generate sources and import them in the same run — a test
 * corpus that writes thousands of feature files, then loads them. Those files
 * do not exist when `prepareExecution` type-checks and emits the entry project,
 * so the entry build never emits them. When one is later required, the runtime
 * hooks must still compile its generated source directory under the entry
 * project's tsconfig and run it correctly. This pins that path: a file created
 * after the build must load and execute, not fail as missing.
 *
 * The generated file is CommonJS-classified (the project has no `type:
 * "module"`) and written with ECMAScript module syntax, so a plain type-strip
 * would leave its `export` dangling; the lowering must turn it into CommonJS.
 *
 * 1. The entry writes `src/generated/leaf.ts` (an `export const`) at runtime, then
 *    `require`s it.
 * 2. Run ttsx against the entry.
 * 3. Assert the generated module loaded and produced its value.
 */
export const test_ttsx_runs_a_source_file_the_entry_generates_at_runtime =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          rootDir: "src",
          esModuleInterop: true,
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const __dirname: string;`,
        `declare function require<T = unknown>(name: string): T;`,
        `const fs = require<{`,
        `  mkdirSync(p: string, o: { recursive: boolean }): void;`,
        `  writeFileSync(p: string, data: string): void;`,
        `}>("node:fs");`,
        `const path = require<{ join(...parts: string[]): string }>(`,
        `  "node:path",`,
        `);`,
        ``,
        `const dir = path.join(__dirname, "generated");`,
        `fs.mkdirSync(dir, { recursive: true });`,
        `fs.writeFileSync(`,
        `  path.join(dir, "leaf.ts"),`,
        `  "export const value: number = 42;\\n",`,
        `);`,
        ``,
        `const leaf = require<{ value: number }>("./generated/leaf");`,
        `console.log("VALUE:" + leaf.value);`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "VALUE:42");
  };

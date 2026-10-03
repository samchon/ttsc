import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx and positional `ttsc <file>` serve the compiled one of two
 * same-stem sources whose extensions differ, `twin.ts` and `twin.tsx`.
 *
 * Both sources map to one `twin.js`, and only one of them can be in it. The
 * compiler decides by precedence when it expands `include` (`.ts` before
 * `.tsx`), and an `exclude` can decide the other way. Ownership lookup settles
 * such an output through the build's source map, which names the file the
 * compiler read, and falls back to that precedence without a map. Refusing
 * both, as the first ownership rule did, broke the ordinary layout with no
 * exclude at all.
 *
 * 1. Create `src/twin.ts` and `src/twin.tsx` with different outputs, and an entry
 *    that imports `./twin`.
 * 2. With no exclude, run the entry and `ttsx src/twin.ts`, and emit `src/twin.ts`
 *    with `ttsc`. Then exclude `src/twin.ts` and the entry that imports it, and
 *    run `ttsx src/twin.tsx`.
 * 3. Assert every run uses the file the compiler compiled.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx imports/runs the .ts winner, positional ttsc emits that winner, then exclusion selects .tsx. Exact distinct messages detect serving a different source with the same emitted stem.
 * @evidence contracts/testing.md#independent-expectations Authored sources log from ts and from tsx. Positional output must contain the .ts literal; expectations do not consult the ownership index.
 * @evidence contracts/testing.md#distinguishing-cases Static import, direct .ts runtime and positional emit contrast with .tsx after excluding .ts and its importer. Direct emit-index units own missing/uncompiled-sibling decisions.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns three initial commands and one post-config-change runtime request in one fixture.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler precedence/maps must drive runtime serving and positional output. Synthetic ownership records cannot establish which source the compiler emits.
 * @evidence contracts/e2e.md#shared-execution All requests share the authored workspace. The exclusion transition requires a new compiler/runtime request, and positional output remains its distinct public command.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Exclusion changes only after original .ts requests finish and removes the importer so it cannot pull .ts back into the program. Process sessions reset module state.
 * @evidence contracts/e2e.md#preserved-coverage Both .ts success/messages, positional success/output and post-exclusion .tsx success/message remain. All assertions collect their failures while later commands and the exclusion transition still execute.
 */
export function test_ttsx_serves_a_source_whose_twin_has_another_typescript_extension() {
  const failures: unknown[] = [];
    const tsconfig = (exclude: string[]): string =>
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          jsx: "react-jsx",
          outDir: "lib",
          rootDir: "src",
          types: [],
        },
        include: ["src"],
        exclude,
      });
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "twins", private: true }),
      "tsconfig.json": tsconfig([]),
      "src/twin.ts": `export const twin: string = "from ts";\nconsole.log(twin);\n`,
      "src/twin.tsx": `export const twin: string = "from tsx";\nconsole.log(twin);\n`,
      "src/main.ts": `import "./twin";\n`,
    });
    const ttsx = (entry: string) =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, entry], {
        cwd: root,
      });

    for (const entry of ["src/main.ts", "src/twin.ts"]) {
      const result = ttsx(entry);
      try { assert.equal(result.status, 0, `${entry}: ${result.stderr}`); } catch (error) { failures.push(error); }
      try { assert.equal(result.stdout.trim(), "from ts", entry); } catch (error) { failures.push(error); }
    }

    const emitted = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "src/twin.ts"],
      { cwd: root },
    );
    try { assert.equal(emitted.status, 0, `${emitted.stdout}${emitted.stderr}`); } catch (error) { failures.push(error); }
    const output = emitted.stdout.trim().split(/\r?\n/).pop()!;
    try { assert.match(
      fs.readFileSync(path.resolve(root, output), "utf8"),
      /from ts/,
    ); } catch (error) { failures.push(error); }

    // The entry's `import "./twin"` would pull `twin.ts` back into the
    // program, so it leaves with it.
    TestProject.writeFiles(root, {
      "tsconfig.json": tsconfig(["src/twin.ts", "src/main.ts"]),
    });
    const tsx = ttsx("src/twin.tsx");
    try { assert.equal(tsx.status, 0, tsx.stderr); } catch (error) { failures.push(error); }
    try { assert.equal(tsx.stdout.trim(), "from tsx"); } catch (error) { failures.push(error); }

  if (failures.length) throw new AggregateError(failures, "serves_a_source_whose_twin_has_another_typescript_extension assertions failed");
}

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
 * 1. Create `src/twin.ts` and `src/twin.tsx` with different outputs, and an
 *    entry that imports `./twin`.
 * 2. With no exclude, run the entry and `ttsx src/twin.ts`, and emit
 *    `src/twin.ts` with `ttsc`. Then exclude `src/twin.ts` and the entry that
 *    imports it, and run `ttsx src/twin.tsx`.
 * 3. Assert every run uses the file the compiler compiled.
 */
export const test_ttsx_serves_a_source_whose_twin_has_another_typescript_extension =
  () => {
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
      assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), "from ts", entry);
    }

    const emitted = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "src/twin.ts"],
      { cwd: root },
    );
    assert.equal(emitted.status, 0, `${emitted.stdout}${emitted.stderr}`);
    const output = emitted.stdout.trim().split(/\r?\n/).pop()!;
    assert.match(fs.readFileSync(path.resolve(root, output), "utf8"), /from ts/);

    // The entry's `import "./twin"` would pull `twin.ts` back into the
    // program, so it leaves with it.
    TestProject.writeFiles(root, {
      "tsconfig.json": tsconfig(["src/twin.ts", "src/main.ts"]),
    });
    const tsx = ttsx("src/twin.tsx");
    assert.equal(tsx.status, 0, tsx.stderr);
    assert.equal(tsx.stdout.trim(), "from tsx");
  };

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx serves several sources that share a file name, each from its
 * own compiled output.
 *
 * The negative twin of the samchon/ttsc#1382 cases: removing name matching must
 * not make the lookup lose a file it legitimately owns. Two `index.ts` files
 * the build emitted resolve to their own outputs whether they are imported
 * statically or required by a computed path, and a third `index.ts` the build
 * never saw is compiled on its own instead of borrowing either.
 *
 * 1. Create `src/a/index.ts` and `src/b/index.ts` inside `include`, and
 *    `tools/index.ts` outside it.
 * 2. Import the first two statically, then require all three by computed paths.
 * 3. Assert every module reports its own identity.
 */
export const test_ttsx_serves_same_named_sources_each_from_its_own_emit =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "same-names", private: true }),
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
      "src/a/index.ts": `export const identity: string = "a";\n`,
      "src/b/index.ts": `export const identity: string = "b";\n`,
      "tools/index.ts": `export const identity: string = "tools";\n`,
      "src/main.ts": [
        `import { identity as a } from "./a/index";`,
        `import { identity as b } from "./b/index";`,
        `declare const require: (id: string) => { identity: string };`,
        `declare const __dirname: string;`,
        `const dynamic: string[] = ["a", "b", "../tools"].map(`,
        `  (name) => require(__dirname + "/" + name + "/index.ts").identity,`,
        `);`,
        `console.log([a, b, ...dynamic].join(","));`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "a,b,a,b,tools");
  };

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies an entry outside the project's `include` compiles under that
 * project's own compiler options rather than a default set.
 *
 * "ttsx targets the tsconfig" is the whole contract for an excluded entry. A
 * synthesized entry-only project that dropped the real options would type-check
 * the entry under different rules than the project it belongs to, so the two
 * options with visible, opposite consequences are the ones pinned here:
 * `strict`, which decides whether the entry compiles at all, and the module
 * format, which decides whether Node hands it `__dirname`.
 *
 * `paths` is deliberately not part of this. It is a compile-time mapping that
 * tsgo does not rewrite into the emit, so no `ttsx` entry resolves an alias at
 * runtime — inside `include` or outside it — and asserting otherwise here would
 * pin a behaviour the product does not have.
 *
 * 1. Create a project whose tsconfig sets `strict` and `include: ["src"]`.
 * 2. Run ttsx against a root-level script whose body only compiles under `strict`
 *    and which reads `__dirname`.
 * 3. Assert it ran, and that the CommonJS package type decided the format.
 */
export const test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "excluded-entry",
        version: "1.0.0",
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/index.ts": `export const hello = (): string => "world";\n`,
      // `value` is only well-typed because the project turns `strict` on: under
      // `strictNullChecks` the guard narrows it, and without the project's
      // options the entry would either compile differently or not at all.
      "clear.ts": [
        `declare const __dirname: string;`,
        ``,
        `const value: string | undefined = "aliased";`,
        `if (value === undefined) throw new Error("unreachable");`,
        `const narrowed: string = value;`,
        ``,
        `console.log(narrowed, typeof __dirname === "string" ? "cjs" : "esm");`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "clear.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "aliased cjs");
  };

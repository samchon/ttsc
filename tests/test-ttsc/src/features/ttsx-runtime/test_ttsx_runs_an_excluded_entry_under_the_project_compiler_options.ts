import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies an entry outside the project's `include` still compiles under that
 * project's compiler options, including its `paths` and its module format.
 *
 * "ttsx targets the tsconfig" is the whole contract for an excluded entry: a
 * synthesized entry-only project that dropped the real options would resolve a
 * path alias to nothing and pick its own module format. The synthesized project
 * therefore `extends` the real tsconfig and overrides only the file set, and it
 * is written beside the real tsconfig so `paths` keep their anchor.
 *
 * 1. Create a project whose tsconfig declares `paths` and `include: ["src"]`.
 * 2. Run ttsx against a root-level script that imports project source through the
 *    alias and reads `__dirname`.
 * 3. Assert the alias resolved, the CommonJS package type decided the format, and
 *    the script printed its own directory.
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
          paths: { "@lib/*": ["./src/*"] },
        },
        include: ["src"],
      }),
      "src/message.ts": `export const message: string = "aliased";\n`,
      // The declaration lives in the entry itself: the synthesized entry
      // project declares only this file, so a root-level `.d.ts` would sit
      // outside its program.
      "clear.ts": [
        `import { message } from "@lib/message";`,
        ``,
        `declare const __dirname: string;`,
        ``,
        `console.log(message, typeof __dirname === "string" ? "cjs" : "esm");`,
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

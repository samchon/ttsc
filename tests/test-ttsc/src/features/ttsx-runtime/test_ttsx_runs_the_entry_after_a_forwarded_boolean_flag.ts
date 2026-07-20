import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `ttsx --pretty <entry>.ts` runs the entry.
 *
 * `--pretty` is a boolean upstream, but the schema declared it value-taking, so
 * the forwarding path took the following token as its value. The entry left
 * `positional` and ttsx failed with "entry file is required" and exit 2 — the
 * same user-visible failure closed issue #663 set out to eliminate, reached
 * through the sibling branch that never consulted the entry predicate.
 *
 * 1. Create a project whose entry prints a recognisable line.
 * 2. Run `ttsx --pretty src/main.ts`.
 * 3. Assert a zero exit, the entry's output, and no "entry file is required".
 */
export const test_ttsx_runs_the_entry_after_a_forwarded_boolean_flag = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `console.log("ENTRY");\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--pretty", "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(
    /entry file is required/.test(result.stderr),
    false,
    `the forwarded boolean flag must not consume the entry:\n${result.stderr}`,
  );
  assert.match(result.stdout, /ENTRY/);
};

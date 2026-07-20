import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `--require` with no value still fails loudly.
 *
 * Declaring `--require` repeatable moved preload collection from a hand-written
 * rescue scan into the schema engine. The scan silently ignored a valueless
 * `-r`; the engine rejects it. This pins the boundary so the move cannot
 * quietly relax the flag's contract: a value flag missing its value is an
 * error, not an empty preload list.
 *
 * The flag has to be the last token and sit before any entry: a `-r` written
 * after the entry belongs to the program's own argv, which is the neighbouring
 * case `test_ttsx_does_not_preload_a_require_written_after_the_entry` pins.
 *
 * 1. Create a project with a runnable entry.
 * 2. Run ttsx with a trailing `-r` that has no value and no entry after it.
 * 3. Assert a non-zero exit and the "requires a value" message.
 */
export const test_ttsx_rejects_a_require_without_a_value = () => {
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
    ["--cwd", root, "-r"],
    { cwd: root },
  );
  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /-r requires a value/);
};

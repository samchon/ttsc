import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs with a forwarded `--inlineSourceMap` and maps a stack
 * trace through it.
 *
 * The runtime build asks for a source map only when the build would carry none.
 * That decision read the config alone, so a forwarded `--inlineSourceMap` met
 * the forced `--sourceMap` in one build and the compiler rejected the pair
 * (TS5053) before the program started. The forwarded flag already carries a
 * map, so none is forced, and the inline one is what the served file inlines.
 *
 * 1. Create a project whose entry, and a file outside `include` it requires, throw
 *    below a few blank lines.
 * 2. Run each with `--inlineSourceMap`.
 * 3. Assert each prints the `.ts` line of the throw.
 */
export const test_ttsx_keeps_a_forwarded_inline_source_map = () => {
  const thrower = (tag: string): string =>
    [
      `declare const console: { log(value: unknown): void };`,
      ``,
      ``,
      `try {`,
      `  throw new Error("${tag}");`,
      `} catch (error) {`,
      `  console.log((error as Error).stack?.split("\\n")[1]?.trim());`,
      `}`,
      `export {};`,
      ``,
    ].join("\n");
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "inlinemap", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        types: [],
      },
      include: ["src"],
    }),
    "src/main.ts": thrower("inside"),
    "outside.ts": thrower("outside"),
  });

  for (const entry of ["src/main.ts", "outside.ts"]) {
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "--inlineSourceMap", entry],
      { cwd: root },
    );
    assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
    assert.match(
      result.stdout,
      new RegExp(`${entry.split("/").pop()!.replace(".", "\\.")}:5:\\d+`),
      entry,
    );
  }
};

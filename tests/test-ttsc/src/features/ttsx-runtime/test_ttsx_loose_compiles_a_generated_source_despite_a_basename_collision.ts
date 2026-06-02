import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loose-compiles a runtime-generated entry source even when its
 * basename collides with a file the gate already emitted.
 *
 * The entry runs at source identity; for a source the gate never emitted (one
 * generated at runtime, outside the static include) ttsx must loose-compile it.
 * Deciding "was this emitted?" by an exact layout mirror is essential: a fuzzy
 * best-match by shared basename would hand back an unrelated emitted `index.js`
 * and silently run the wrong module.
 *
 * 1. A project whose gate emits `src/foo/index.ts` and `src/bar/index.ts`.
 * 2. The entry writes `generated/index.ts` at runtime and imports it by path.
 * 3. Assert the generated module ran, not a same-basename gate emit.
 */
export const test_ttsx_loose_compiles_a_generated_source_despite_a_basename_collision =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: ".",
        },
        include: ["src"],
      }),
      "src/foo/index.ts": `export const value = "foo";\n`,
      "src/bar/index.ts": `export const value = "bar";\n`,
      "src/main.ts":
        `declare const __dirname: string;\n` +
        `declare const process: { exitCode?: number };\n` +
        `declare function require(name: string): any;\n` +
        `const fs = require("node:fs") as { mkdirSync(p: string, o: { recursive: boolean }): void; writeFileSync(f: string, t: string): void };\n` +
        `const path = require("node:path") as { join(...p: string[]): string };\n` +
        `async function main(): Promise<void> {\n` +
        `  const generated = path.join(__dirname, "..", "generated");\n` +
        `  fs.mkdirSync(generated, { recursive: true });\n` +
        `  fs.writeFileSync(path.join(generated, "index.ts"), "export const value = 'gen';\\n");\n` +
        `  const mod = await import(path.join(generated, "index.ts")) as { value: string };\n` +
        `  console.log(mod.value);\n` +
        `}\n` +
        `main().catch((error) => { console.error(error); process.exitCode = 1; });\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "gen");
  };

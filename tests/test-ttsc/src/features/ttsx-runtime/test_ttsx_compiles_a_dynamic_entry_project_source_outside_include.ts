import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx can run an entry-project TypeScript file reached dynamically
 * from outside the tsconfig's initial input set.
 *
 * Runtime framework/config loaders often construct an absolute path to a
 * sibling `.ts` file with `path.join()` and then `import()` it. TypeScript
 * cannot see that computed import while building the entry graph, so the file
 * is not emitted by the compile gate even though it belongs to the same
 * project. Ttsx must compile that source on demand instead of treating the
 * missing gate output as fatal.
 *
 * 1. Build only `src` through the entry project's `include`.
 * 2. Dynamically import root-level `runtime.config.ts` through a computed path.
 * 3. Assert the imported file ran at source identity.
 */
export const test_ttsx_compiles_a_dynamic_entry_project_source_outside_include =
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
      "runtime.config.ts":
        `declare const __filename: string;\n` +
        `export const value = "runtime-config:" + __filename.endsWith("runtime.config.ts");\n`,
      "src/main.ts":
        `declare const __dirname: string;\n` +
        `declare const process: { exitCode?: number };\n` +
        `declare function require(name: string): any;\n` +
        `const path = require("node:path") as { join(...parts: string[]): string };\n` +
        `async function main(): Promise<void> {\n` +
        `  const location = path.join(__dirname, "..", "runtime.config.ts");\n` +
        `  const mod = await import(location) as { value: string };\n` +
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
    assert.equal(result.stdout.trim(), "runtime-config:true");
  };

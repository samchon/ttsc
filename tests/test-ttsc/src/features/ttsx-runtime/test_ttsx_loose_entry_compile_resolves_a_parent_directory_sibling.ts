import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a loose-compiled entry source can import a sibling in a parent
 * directory without writing stray output into the project's source tree.
 *
 * A runtime-generated source often imports back into the project
 * (`../src/...`). The loose compile emits relative to the entry's source root,
 * so a parent import lands under the loose emit dir; a regression that emitted
 * relative to only the generated file's own directory would write the parent
 * sibling's `.js` next to the real source. This pins both that the import runs
 * and that the source tree stays clean.
 *
 * 1. A project generates `generated/good.ts` at runtime that imports
 *    `../src/shared`.
 * 2. Dynamically import the generated source by absolute path.
 * 3. Assert it runs and no stray `src/shared.js` was written beside the source.
 */
export const test_ttsx_loose_entry_compile_resolves_a_parent_directory_sibling =
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
        include: ["src", "generated"],
      }),
      "src/shared.ts": `export const shared: string = "from-parent";\n`,
      "src/main.ts":
        `declare const __dirname: string;\n` +
        `declare const process: { exitCode?: number };\n` +
        `declare function require(name: string): any;\n` +
        `const fs = require("node:fs") as { mkdirSync(p: string, o: { recursive: boolean }): void; writeFileSync(f: string, t: string): void };\n` +
        `const path = require("node:path") as { join(...p: string[]): string };\n` +
        `async function main(): Promise<void> {\n` +
        `  const generated = path.join(__dirname, "..", "generated");\n` +
        `  fs.mkdirSync(generated, { recursive: true });\n` +
        `  fs.writeFileSync(path.join(generated, "good.ts"), "import { shared } from '../src/shared';\\nexport const value = shared + ':ok';\\n");\n` +
        `  const mod = await import(path.join(generated, "good.ts")) as { value: string };\n` +
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
    assert.equal(result.stdout.trim(), "from-parent:ok");
    assert.equal(
      fs.existsSync(path.join(root, "src", "shared.js")),
      false,
      "loose compile must not write output beside the project source",
    );
  };

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Ensures a runtime-only entry-project source is compiled as that entry and its
 * imports, not every file matched by the parent tsconfig's inherited include.
 *
 * Generated test runners often create a directory of TypeScript files after the
 * ttsx compile gate has already passed, then import only one generated file at
 * a time. A sibling generated file can contain a transform or type error for a
 * different test case. The loose runtime compile must not let the inherited
 * project include pull that unrelated sibling into the current entry build.
 */
export const test_ttsx_loose_entry_compile_ignores_inherited_include_siblings =
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
      "src/main.ts":
        `declare const __dirname: string;\n` +
        `declare const process: { exitCode?: number };\n` +
        `declare function require(name: string): any;\n` +
        `const fs = require("node:fs") as { mkdirSync(path: string, options: { recursive: boolean }): void; writeFileSync(file: string, text: string): void };\n` +
        `const path = require("node:path") as { join(...parts: string[]): string };\n` +
        `async function main(): Promise<void> {\n` +
        `  const generated = path.join(__dirname, "..", "generated");\n` +
        `  fs.mkdirSync(generated, { recursive: true });\n` +
        `  fs.writeFileSync(path.join(generated, "helper.ts"), "export const helper = 'helper';\\n");\n` +
        `  fs.writeFileSync(path.join(generated, "good.ts"), "import { helper } from './helper';\\ndeclare const __filename: string;\\nexport const value = helper + ':' + __filename.endsWith('good.ts');\\n");\n` +
        `  fs.writeFileSync(path.join(generated, "bad.ts"), "const broken: string = 1;\\nexport const value = broken;\\n");\n` +
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
    assert.equal(result.stdout.trim(), "helper:true");
  };

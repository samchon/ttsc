import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import { goPath } from "../../internal/plugin-corpus";

/**
 * Verifies ttsx runs typia transform output for a runtime-only entry source.
 *
 * Generated framework/test files can be written after the compile gate has
 * already emitted the entry graph, then imported by a computed absolute path.
 * That source still belongs to the entry project, so its loose runtime compile
 * must inherit the entry project's transform plugins while keeping the file's
 * own `.ts` filename identity.
 *
 * 1. Build an entry project that depends on typia but generates `good.ts` later.
 * 2. Dynamically import that generated source through an absolute path.
 * 3. Assert the typia validator runs, the source filename is preserved, and the
 *    loose emit no longer contains the raw `createIs` call.
 */
export const test_ttsx_runs_typia_transform_output_in_a_dynamic_entry_project_source =
  () => {
    const generatedGoodSource =
      `import typia from "typia";\n` +
      `interface User {\n` +
      `  id: string;\n` +
      `  age: number;\n` +
      `  tags: string[];\n` +
      `}\n` +
      `const isUser = typia.createIs<User>();\n` +
      `declare const __filename: string;\n` +
      `export const verdict = [\n` +
      `  isUser({ id: "user-1", age: 42, tags: ["admin"] }),\n` +
      `  isUser({ id: "user-2", age: "bad", tags: ["admin"] }),\n` +
      `  __filename.endsWith("good.ts"),\n` +
      `].join(":");\n`;
    const generatedBadSource =
      `const broken: string = 1;\n` + `export const value = broken;\n`;
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        dependencies: { typia: "*" },
        private: true,
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          skipLibCheck: true,
          outDir: "dist",
          rootDir: ".",
        },
        include: ["src", "generated"],
      }),
      "src/main.ts":
        `declare const __dirname: string;\n` +
        `declare const process: { env: Record<string, string | undefined>; exitCode?: number };\n` +
        `declare function require(name: string): any;\n` +
        `type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean };\n` +
        `const fs = require("node:fs") as {\n` +
        `  mkdirSync(path: string, options: { recursive: boolean }): void;\n` +
        `  writeFileSync(file: string, text: string): void;\n` +
        `  readFileSync(file: string, encoding: "utf8"): string;\n` +
        `  readdirSync(directory: string, options: { withFileTypes: true }): Dirent[];\n` +
        `};\n` +
        `const path = require("node:path") as {\n` +
        `  join(...parts: string[]): string;\n` +
        `  resolve(...parts: string[]): string;\n` +
        `  sep: string;\n` +
        `};\n` +
        `\n` +
        `main().catch((error) => { console.error(error); process.exitCode = 1; });\n` +
        `\n` +
        `async function main(): Promise<void> {\n` +
        `const root = path.resolve(__dirname, "..");\n` +
        `const generated = path.join(root, "generated");\n` +
        `fs.mkdirSync(generated, { recursive: true });\n` +
        `fs.writeFileSync(path.join(generated, "good.ts"), ${JSON.stringify(generatedGoodSource)});\n` +
        `fs.writeFileSync(path.join(generated, "bad.ts"), ${JSON.stringify(generatedBadSource)});\n` +
        `\n` +
        `const good = path.join(generated, "good.ts");\n` +
        `const mod = await import(good) as { verdict: string };\n` +
        `const emitted = findLooseGoodEmit(process.env.TTSC_TTSX_ENTRY_EMIT_DIR);\n` +
        `if (emitted === null) {\n` +
        `  throw new Error("loose good.js emit was not found");\n` +
        `}\n` +
        `const emittedText = fs.readFileSync(emitted, "utf8");\n` +
        `if (emittedText.includes("createIs")) {\n` +
        `  throw new Error("typia createIs call survived in loose runtime emit");\n` +
        `}\n` +
        `console.log(mod.verdict);\n` +
        `}\n` +
        `\n` +
        `function findLooseGoodEmit(entryEmitDir: string | undefined): string | null {\n` +
        `  if (entryEmitDir === undefined) return null;\n` +
        `  const looseSegment = path.sep + ".ttsx-loose" + path.sep;\n` +
        `  const stack = [entryEmitDir];\n` +
        `  while (stack.length !== 0) {\n` +
        `    const current = stack.pop()!;\n` +
        `    let entries: Dirent[];\n` +
        `    try {\n` +
        `      entries = fs.readdirSync(current, { withFileTypes: true });\n` +
        `    } catch {\n` +
        `      continue;\n` +
        `    }\n` +
        `    for (const entry of entries) {\n` +
        `      const next = path.join(current, entry.name);\n` +
        `      if (entry.isDirectory()) {\n` +
        `        stack.push(next);\n` +
        `      } else if (\n` +
        `        entry.isFile() &&\n` +
        `        entry.name === "good.js" &&\n` +
        `        next.includes(looseSegment)\n` +
        `      ) {\n` +
        `        return next;\n` +
        `      }\n` +
        `    }\n` +
        `  }\n` +
        `  return null;\n` +
        `}\n`,
    });
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.symlinkSync(
      installedTypiaRoot(),
      path.join(root, "node_modules", "typia"),
      "junction",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "true:false:true");
  };

function installedTypiaRoot(): string {
  const requireFromWebsite = createRequire(
    path.join(TestProject.WORKSPACE_ROOT, "website", "package.json"),
  );
  return path.dirname(requireFromWebsite.resolve("typia/package.json"));
}

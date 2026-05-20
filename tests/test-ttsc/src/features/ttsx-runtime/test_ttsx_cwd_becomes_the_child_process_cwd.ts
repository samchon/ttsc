import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx --cwd becomes the child process cwd.
 *
 * When ttsx is invoked from one directory (e.g. the shell's cwd) with `--cwd
 * <project>`, the compiled entry must run with `process.cwd()` set to the
 * `--cwd` value, not the shell cwd. This matters for entries that read files
 * relative to `process.cwd()`.
 *
 * 1. Create a project in a subdirectory (`parent/app/`).
 * 2. Run ttsx from the parent directory with `--cwd parent/app/`.
 * 3. Assert the entry's `process.cwd()` returns `app` as the last path component.
 */
export const test_ttsx_cwd_becomes_the_child_process_cwd = () => {
  const parent = TestProject.tmpdir("ttsc-smoke-parent-");
  const root = path.join(parent, "app");
  fs.mkdirSync(root, { recursive: true });
  for (const [name, contents] of Object.entries({
    "package.json": JSON.stringify({ private: true }),
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
    "src/main.ts": `declare const process: { cwd(): string };\nconst parts = process.cwd().split(/[\\\\/]/);\nconsole.log(parts[parts.length - 1]);\n`,
  })) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    {
      cwd: parent,
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "app");
};

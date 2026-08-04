import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies an entry that is itself a symlink runs under the name it was given.
 *
 * The entry's directory is resolved to the filesystem's own spelling so it can
 * be compared against a project root that arrives resolved. The entry _file_ is
 * deliberately not, and the ownership guard has to agree: a filesystem-identity
 * containment test folds the link, places the entry at its target — outside a
 * `rootDir` that was never widened to reach there — and rejects an entry that
 * compiles and runs perfectly well, with `emitted entry not found`.
 *
 * The link's target sits outside the project on purpose. A target inside it
 * would pass either test and prove nothing.
 *
 * 1. Put the real script outside the project and link to it from inside.
 * 2. Run ttsx against the link.
 * 3. Assert it ran and printed the target's output.
 */
export const test_ttsx_runs_an_entry_that_is_itself_a_symlink = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({
      name: "symlinked-entry",
      version: "1.0.0",
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "commonjs",
        outDir: "lib",
        rootDir: "src",
        strict: true,
        target: "ES2022",
      },
      include: ["src"],
    }),
    "src/index.ts": `export const hello = (): string => "world";\n`,
  });
  const outside = path.join(path.dirname(root), `${path.basename(root)}-away`);
  fs.mkdirSync(outside, { recursive: true });
  const target = path.join(outside, "clear.ts");
  fs.writeFileSync(target, `console.log("ran-through-the-link");\n`, "utf8");

  const link = path.join(root, "clear.ts");
  try {
    fs.symlinkSync(target, link, "file");
  } catch {
    // Without symlink permission there is no link to run through, and the
    // guard this pins cannot be exercised at all.
    return;
  }
  try {
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "clear.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ran-through-the-link/);
  } finally {
    try {
      fs.unlinkSync(link);
    } catch {
      // Left behind in the system temp directory.
    }
    fs.rmSync(outside, { force: true, recursive: true });
  }
};

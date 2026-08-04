import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies an entry that is itself a symlink still runs.
 *
 * Every party to the entry's identity speaks the physical spelling: the project
 * root arrives resolved, tsgo emits from the path it opens, and the runtime
 * hooks key a served file by `fs.realpathSync`, because that is how Node itself
 * identifies a module without `--preserve-symlinks`. Resolving the entry any
 * other way is a fourth answer, and the disagreements are not symmetric — a
 * containment guard that folds the link while the spelling does not rejects the
 * entry outright, and the reverse leaves the gate owning an emit the runtime
 * refuses to serve.
 *
 * This pins the observable half: the run succeeds and the linked script's own
 * output arrives. That the _project's_ emit is what served it follows from the
 * spellings agreeing, and is not separately observable here — both lanes can
 * print. The link's target sits outside the project on purpose; a target inside
 * it would satisfy every spelling rule and prove nothing.
 *
 * 1. Put the real script outside the project and link to it from inside.
 * 2. Run ttsx against the link.
 * 3. Assert it ran and printed what the target says.
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
  // Tracked by the harness, so it is reclaimed even on the early return below.
  const outside = TestProject.tmpdir("ttsc-symlink-target-");
  fs.writeFileSync(
    path.join(outside, "clear.ts"),
    [
      `const ran: string = "ran-through-the-link";`,
      `console.log(ran);`,
      "",
    ].join("\n"),
    "utf8",
  );

  const link = path.join(root, "clear.ts");
  try {
    fs.symlinkSync(path.join(outside, "clear.ts"), link, "file");
  } catch {
    // Without symlink permission there is no link to run through, and the
    // contract this pins cannot be exercised at all.
    return;
  }
  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "clear.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ran-through-the-link/);
};

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runTtsxWithCoverage } from "../../internal/ttsx-source-map";

/**
 * Verifies an entry that is itself a symlink is served by the project's own
 * emit, not by the orphan type-strip lane.
 *
 * Two different questions are asked about an entry, and they have two different
 * answers. _Which project compiles this?_ comes from the path the user named,
 * because discovery walks up from it — resolving the link first would look for
 * a tsconfig in the target's tree. _Where is the output and what does the
 * runtime load?_ comes from the physical path, because tsgo emits from the file
 * it opens and Node keys a module by `fs.realpathSync` without
 * `--preserve-symlinks`.
 *
 * Getting either half wrong is silent. One spelling too few and the gate claims
 * an emit the runtime then refuses to serve, so the file falls to the orphan
 * lane and the project's transform plugins, `target`, `paths`, and source map
 * are all dropped from a run that still prints and still exits zero.
 *
 * So printing is not the assertion. The served script's source map is: the
 * entry-project lane inlines one (forced on when the project configures none),
 * and the orphan lane emits with `--ignoreConfig` and no `--sourceMap` at all.
 *
 * 1. Put the real script outside the project and link to it from inside.
 * 2. Run ttsx against the link under V8 coverage.
 * 3. Assert it ran and that the served script carries a source map.
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
  const run = runTtsxWithCoverage(root, "clear.ts");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ran-through-the-link/);

  const script = run.scriptEndingWith("clear.ts");
  assert.ok(script, "coverage must record the served clear.ts script");
  assert.ok(
    script.sourceMap !== null,
    "a served entry carries the project emit's source map; the orphan lane has none",
  );
};

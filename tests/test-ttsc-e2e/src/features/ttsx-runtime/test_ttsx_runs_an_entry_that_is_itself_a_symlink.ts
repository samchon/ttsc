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
 * runtime load?_ comes from the physical path, because Node keys a module by
 * `fs.realpathSync` without `--preserve-symlinks`. tsgo forces nothing — it
 * takes `files` verbatim — which is exactly why it must be handed Node's
 * spelling rather than a different one.
 *
 * A source map alone cannot distinguish project emit from orphan lowering,
 * because both lanes supply maps. ES2019 lowering of optional chaining is the
 * independent project-option witness; isolated orphan emit uses a modern
 * target and would retain that syntax.
 *
 * 1. Link an external source into a project configured for ES2019.
 * 2. Execute the linked entry under V8 coverage.
 * 3. Require its original marker, lowered optional chaining and served map.
 * @evidence contracts/testing.md#behavioral-verification Runs a linked external clear.ts under V8 coverage and checks success, its original marker, lowered optional-function syntax, a recorded script and nonnull source map.
 * @evidence contracts/testing.md#independent-expectations The ES2019 language contract requires optional chaining to be lowered; the authored function source and its false syntax result independently distinguish project options from modern isolated orphan emit. The V8 record separately establishes map presence.
 * @evidence contracts/testing.md#distinguishing-cases The lexical owning project requests ES2019 while the external physical source has no config. Unavailable symlink creation still returns early; nonnull maps alone are deliberately not a lane discriminator.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_an_entry_that_is_itself_a_symlink at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary The real filesystem alias, native emission and Node coverage connection remain necessary for observing served-source behavior.
 * @evidence contracts/e2e.md#shared-execution One source project, linked target and host reuse installed compiler preparation; coverage is collected for this invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both tracked directories own the link and target; coverage is read after synchronous completion and fixture cleanup occurs at process exit.
 * @evidence contracts/e2e.md#preserved-coverage All original status, marker, V8-script and map assertions remain; the additional false optional-chain result now independently establishes project-option inheritance instead of relying on the disproved orphan-no-map premise.
 */
export function test_ttsx_runs_an_entry_that_is_itself_a_symlink() {
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
        target: "ES2019",
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
      `function optional(value?: { answer: number }) { return value?.answer; }`,
      `console.log("native-optional=" + optional.toString().includes("?."));`,
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
  assert.match(run.stdout, /(?:^|\r?\n)native-optional=false(?:\r?\n|$)/);

  const script = run.scriptEndingWith("clear.ts");
  assert.ok(script, "coverage must record the served clear.ts script");
  assert.ok(
    script.sourceMap !== null,
    "the served linked entry must carry a resolvable source map",
  );
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies emptying and recreating the configured output directory costs
 * nothing on a host with no build boundary.
 *
 * `emptyOutDir` and `output.clean` do exactly this on every build, so the event
 * arrives on the project root's own watch. The walk never descends into a
 * configured `outDir`, so a tracker that reported it anyway would be the one
 * side reacting, voiding the generation once per build. A plain `exclude` entry
 * naming a file is the boundary in the other direction: that file is still
 * walked and hashed, so its events must keep counting.
 *
 * 1. Deliver persistently with `outDir: "artifacts"`, then empty and recreate the
 *    directory three times.
 * 2. Assert no further compile.
 * 3. Exclude a file by name, create it, and assert its membership event still
 *    counts.
 *
 * @evidence contracts/testing.md#behavioral-verification Three output-directory recreations keep settled compile count; explicit file exclusion then file creation increases count.
 * @evidence contracts/testing.md#independent-expectations Fixture native counter tests effective membership policy; authored outDir/exclude settings define the two boundaries.
 * @evidence contracts/testing.md#distinguishing-cases Ignored configured output directory versus file exclusion that still belongs to walk.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_recreating_the_output_directory_costs_nothing is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for ignored configured output directory versus file exclusion that still belongs to walk. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. Session.close runs in finally and resets its cache observers; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Three output-directory recreations keep settled compile count; explicit file exclusion then file creation increases count. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_recreating_the_output_directory_costs_nothing(): Promise<void> {
  const session = await startMembershipSession({
    outDir: "artifacts",
  });
  try {
    const artifacts = path.join(session.root, "artifacts");
    fs.mkdirSync(artifacts, { recursive: true });
    fs.writeFileSync(path.join(artifacts, "bundle.js"), "// one", "utf8");
    await session.deliver();
    const settled = session.compiles();

    for (let build = 1; build <= 3; build += 1) {
      fs.rmSync(artifacts, { force: true, recursive: true });
      fs.mkdirSync(artifacts, { recursive: true });
      fs.writeFileSync(
        path.join(artifacts, `bundle.${build}.js`),
        `// ${build}`,
        "utf8",
      );
      await session.deliver();
    }
    assert.equal(
      session.compiles(),
      settled,
      "recreating the configured output directory must not void the generation",
    );

    // An explicit top-level `exclude` replaces TypeScript's implicit output
    // exclusions. Install that separate boundary in the same session only
    // after the output-directory lifecycle above has proved the default.
    const tsconfig = path.join(session.root, "tsconfig.json");
    const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
      exclude?: string[];
    };
    parsed.exclude = ["src/legacy.ts"];
    fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");
    await session.deliver();
    const explicitExcludeSettled = session.compiles();

    // A plain `exclude` entry naming a file is not a directory exclusion. The
    // walk still hashes that file, so its appearance must keep counting.
    fs.writeFileSync(
      path.join(session.root, "src", "legacy.ts"),
      "export const legacy: number = 1;",
      "utf8",
    );
    await session.deliver();
    assert.ok(
      session.compiles() > explicitExcludeSettled,
      "a file the walk hashes must still report its own membership",
    );
  } finally {
    session.close();
  }
}

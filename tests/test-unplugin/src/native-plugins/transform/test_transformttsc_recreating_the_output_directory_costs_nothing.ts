import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies emptying and recreating the configured output directory costs
 * nothing, on a host with no build boundary.
 *
 * `emptyOutDir` and `output.clean` do exactly this on every build, so the event
 * arrives on the project root's own watch: the directory disappears and
 * reappears. The walk never descends into a configured `outDir`, so the
 * membership digest cannot see anything there, and a tracker that reported the
 * directory anyway would be the one side reacting to it, voiding the generation
 * once per build for the whole session.
 *
 * A plain `exclude` entry naming a _file_ is the boundary case in the other
 * direction: that file is still walked and still hashed, so its events must
 * keep counting.
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

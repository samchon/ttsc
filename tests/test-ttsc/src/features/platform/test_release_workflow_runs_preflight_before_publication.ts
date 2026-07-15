import { assert, fs, path, workspaceRoot } from "../../internal/toolchain";

/**
 * Verifies the release workflow runs the preflight gate before any publication.
 *
 * Locks the ordering in `.github/workflows/release.yml`. The preflight script
 * is only a real gate if it executes before the first external mutation, so a
 * future edit that moves publication ahead of the preflight must fail here. The
 * negative twin is the publication commands themselves: their positions in the
 * workflow text must all come after the preflight invocation.
 *
 * 1. Read the release workflow.
 * 2. Locate the preflight invocation and each publication command.
 * 3. Assert the preflight appears exactly once and strictly before the Marketplace
 *    publish, the npm publish, and the first credential use.
 */
export const test_release_workflow_runs_preflight_before_publication = () => {
  const workflow = fs.readFileSync(
    path.join(workspaceRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );

  const preflight = workflow.indexOf("scripts/release-preflight.cjs");
  assert.notEqual(preflight, -1, "release-preflight.cjs step is missing");
  assert.equal(
    workflow.lastIndexOf("scripts/release-preflight.cjs"),
    preflight,
    "release-preflight.cjs must be invoked exactly once",
  );

  const marketplacePublish = workflow.indexOf("publish-vscode-marketplace.sh");
  const npmPublish = workflow.indexOf("package:latest:publish");
  const credential = workflow.indexOf("VSCE_PAT");
  const build = workflow.indexOf("pnpm run build");

  for (const [label, index] of [
    ["build", build],
    ["Marketplace publish", marketplacePublish],
    ["npm publish", npmPublish],
    ["credential use", credential],
  ] as Array<[string, number]>) {
    assert.notEqual(index, -1, `expected to find ${label} step`);
    assert.ok(
      preflight < index,
      `preflight (index ${preflight}) must run before ${label} (index ${index})`,
    );
  }
};

import { assert, fs, path, workspaceRoot } from "../../internal/toolchain";

/**
 * Verifies release preflight precedes publication without a Marketplace gate.
 *
 * Locks the ordering in `.github/workflows/release.yml`. Deterministic tag and
 * package validation must precede build and credential use, while eventual
 * consistency in the public Marketplace index must not block the independent
 * npm release channel.
 *
 * Order is a property of what the workflow runs, so the comments come out
 * first. #726 documented the runner's disk reclaim in prose that names `pnpm
 * run build`, several lines above the step that invokes it, and a raw text scan
 * read that sentence as the build itself and reported it running before the
 * preflight. The workflow was correct and this gate was not. Prose about a
 * command is not the command, and a gate that cannot tell them apart fails on
 * the next comment that mentions one.
 *
 * 1. Read the release workflow and drop its comment lines.
 * 2. Locate deterministic preflight, build, credentials, and both publications.
 * 3. Assert preflight precedes every mutation and no Marketplace probe is wired
 *    into the release path.
 */
export const test_release_workflow_runs_preflight_before_publication = () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );
  // A `#` opening a line is a YAML comment; one inside a value is not, and no
  // step this gate looks for is written on a commented line.
  const workflow = source
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

  const preflight = workflow.indexOf("scripts/release-preflight.cjs");
  assert.notEqual(preflight, -1, "release-preflight.cjs step is missing");
  assert.equal(
    workflow.lastIndexOf("scripts/release-preflight.cjs"),
    preflight,
    "release-preflight.cjs must be invoked exactly once",
  );

  assert.equal(
    workflow.indexOf("scripts/assert-marketplace-version.cjs"),
    -1,
    "public Marketplace indexing must not gate the release workflow",
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
  assert.ok(
    marketplacePublish < npmPublish,
    "Marketplace publication must run before npm publication",
  );
};

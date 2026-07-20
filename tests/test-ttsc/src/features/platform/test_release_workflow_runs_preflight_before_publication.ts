import { assert, fs, path, workspaceRoot } from "../../internal/toolchain";

/**
 * Verifies release gates surround Marketplace publication before npm.
 *
 * Locks the ordering in `.github/workflows/release.yml`. Public Marketplace
 * readiness must be proven before build or credential use, and the tagged
 * version must be anonymously served after Marketplace publication but before
 * the irreversible npm publication.
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
 * 2. Locate both preflights, both publications, and the exact-version gate.
 * 3. Assert readiness precedes every mutation and exact verification sits strictly
 *    between Marketplace and npm publication.
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

  const marketplaceProbe = "scripts/assert-marketplace-version.cjs";
  const readiness = workflow.indexOf(marketplaceProbe);
  const exactVersion = workflow.indexOf(marketplaceProbe, readiness + 1);
  assert.notEqual(readiness, -1, "Marketplace readiness gate is missing");
  assert.notEqual(
    exactVersion,
    -1,
    "Marketplace exact-version gate is missing",
  );
  assert.equal(
    workflow.indexOf(marketplaceProbe, exactVersion + 1),
    -1,
    "Marketplace probe must be invoked exactly twice",
  );
  assert.match(
    workflow.slice(exactVersion, workflow.indexOf("\n", exactVersion)),
    /--version "\$\{GITHUB_REF_NAME#v\}"/,
    "post-publish gate must query the tagged release version",
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
      readiness < index,
      `readiness (index ${readiness}) must run before ${label} (index ${index})`,
    );
  }
  assert.ok(
    preflight < readiness,
    "deterministic release preflight must run before public readiness",
  );
  assert.ok(
    marketplacePublish < exactVersion,
    "exact-version gate must run after Marketplace publication",
  );
  assert.ok(
    exactVersion < npmPublish,
    "exact-version gate must run before npm publication",
  );
};

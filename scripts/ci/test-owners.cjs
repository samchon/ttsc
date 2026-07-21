// Prove that every committed executable test owner is claimed by exactly one
// CI executor.
//
// The repository used to decide what CI runs from hand-written lists —
// `scripts/test-go.cjs` names the runners, each runner names its Go packages,
// and `.github/workflows/test.yml` names one matrix lane per suite. Nothing
// bound any of them to the suites that exist on disk, so a committed,
// executable, passing suite that no list named simply never ran, with no signal
// of any kind. Issue #622 was closed by lengthening a list; within a day three
// new orphans appeared and an older one had survived the fix. The finite list is
// the cause, so the remedy has to be an invariant that fails on the next
// unclaimed suite rather than four more names.
//
// The invariant here is two-way. Every owner discovered on disk must appear in
// OWNERSHIP, and every OWNERSHIP entry must still exist on disk. Adding a suite
// without claiming it turns this red; deleting a suite without unclaiming it
// turns this red too, so the map cannot rot into a list of names for things that
// are gone.
//
// Deliberate exclusion stays possible and stays visible: an owner may be claimed
// by `EXCLUDED` with a reason, which is an explicit, named, reviewable entry
// rather than the silence that caused this.

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

/** An owner excluded on purpose carries this instead of an executor. */
const EXCLUDED = "excluded";

/**
 * Who runs each committed test owner.
 *
 * Keys are the ids `discoverOwners` produces. Values name the executor — a
 * runner script under `scripts/`, a workflow lane, or a package script — or
 * `[EXCLUDED, reason]`.
 */
const OWNERSHIP = {
  // ---- Go: packages/ttsc, split across three runners ----
  "go:packages/ttsc/test/driver": "scripts/test-go-driver.cjs",
  "go:packages/ttsc/internal/lspserver": "scripts/test-go-ttsc.cjs",
  "go:packages/ttsc/test/cli": "scripts/test-go-ttsc.cjs",
  "go:packages/ttsc/test/ttscserver": "scripts/test-go-ttsc.cjs",
  "go:packages/ttsc/test/platform": "scripts/test-go-ttsc.cjs",
  "go:packages/ttsc/test/utility": "scripts/test-go-ttsc.cjs",
  "go:packages/ttsc/cmd/ttsc": "scripts/test-go-ttsc.cjs",
  "go:packages/ttsc/cmd/ttscserver": "scripts/test-go-ttsc.cjs",
  "go:packages/ttsc/internal/graph": "scripts/test-go-graph.cjs",
  "go:packages/ttsc/cmd/ttscgraph": "scripts/test-go-graph.cjs",
  "go:packages/ttsc/internal/graphsymbols": "scripts/test-go-graph.cjs",
  "go:packages/ttsc/shim/ast/test": "scripts/test-go-shim.cjs",
  "go:packages/ttsc/tools/shim_audit": "scripts/test-go-shim.cjs",

  // ---- Go: the utility plugins and the rest ----
  "go:packages/banner/test": "scripts/test-go-utility-plugins.cjs",
  "go:packages/paths/test": "scripts/test-go-utility-plugins.cjs",
  "go:packages/strip/test": "scripts/test-go-utility-plugins.cjs",
  "go:packages/wasm/test/host": "scripts/test-go-wasm.cjs",
  "go:tests/go-transformer/transformer": "scripts/test-go-transformer.cjs",

  // ---- e2e workspace packages ----
  "e2e:test-banner": "test.yml lane: banner",
  "e2e:test-factory": "test.yml lane: factory",
  "e2e:test-graph": "test.yml lane: graph",
  "e2e:test-lint": "test.yml lanes: lint fast, lint native *",
  "e2e:test-metro": "test.yml lane: metro",
  "e2e:test-paths": "test.yml lane: paths",
  "e2e:test-playground": "test.yml lane: playground",
  "e2e:test-strip": "test.yml lane: strip",
  "e2e:test-ttsc": "test.yml lanes: ttsc fast, ttsc native *",
  "e2e:test-unplugin": "test.yml lane: unplugin",
  "e2e:test-wasm": "test.yml lane: wasm",

  // ---- website ----
  "website:rss-autodiscovery.test.cjs": "website postbuild",
  "website:typia-dependency-graph.test.cjs": "website postbuild",
};

/** Every `packages/lint/test/**` directory runs through one flattening runner. */
const LINT_GO_RUNNER = "scripts/test-go-lint.cjs";

/**
 * Walk `dir` and yield every directory holding at least one `*_test.go`.
 *
 * Discovery reads the tree rather than a manifest, which is the whole point: a
 * suite that exists is discovered whether or not anyone remembered it.
 */
function goTestDirectories(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  let hasTest = false;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      goTestDirectories(path.join(dir, entry.name), out);
      continue;
    }
    if (entry.name.endsWith("_test.go")) hasTest = true;
  }
  if (hasTest) out.push(path.relative(root, dir).split(path.sep).join("/"));
  return out;
}

/** Every committed executable test owner, discovered from the tree. */
function discoverOwners() {
  const owners = [];
  for (const go of goTestDirectories(path.join(root, "packages"), []).concat(
    goTestDirectories(path.join(root, "tests"), []),
  ))
    owners.push(`go:${go}`);
  for (const entry of fs.readdirSync(path.join(root, "tests"), {
    withFileTypes: true,
  }))
    if (entry.isDirectory() && entry.name.startsWith("test-"))
      owners.push(`e2e:${entry.name}`);
  const websiteTests = path.join(root, "website", "test");
  if (fs.existsSync(websiteTests))
    for (const file of fs.readdirSync(websiteTests))
      if (file.endsWith(".test.cjs")) owners.push(`website:${file}`);
  return owners.sort();
}

/** The executor claiming `owner`, or undefined when nothing claims it. */
function claimOf(owner) {
  if (owner.startsWith("go:packages/lint/test/")) return LINT_GO_RUNNER;
  return OWNERSHIP[owner];
}

/**
 * Both directions of the invariant, as a list of human-readable failures.
 *
 * Returning failures rather than throwing lets the caller decide the reporting
 * shape; `test-owners.test.cjs` asserts the list is empty.
 */
function ownershipFailures() {
  const owners = discoverOwners();
  const discovered = new Set(owners);
  const failures = [];
  for (const owner of owners)
    if (claimOf(owner) === undefined)
      failures.push(
        `unclaimed: ${owner} — no runner list and no workflow lane runs it. ` +
          `Claim it in scripts/ci/test-owners.cjs, or exclude it there with a reason.`,
      );
  for (const owner of Object.keys(OWNERSHIP))
    if (!discovered.has(owner))
      failures.push(
        `stale claim: ${owner} — claimed in scripts/ci/test-owners.cjs but not present on disk.`,
      );
  return failures;
}

module.exports = {
  EXCLUDED,
  OWNERSHIP,
  claimOf,
  discoverOwners,
  ownershipFailures,
};

if (require.main === module) {
  const failures = ownershipFailures();
  if (failures.length === 0) {
    const owners = discoverOwners();
    process.stdout.write(
      `scripts/ci/test-owners.cjs: ${owners.length} test owners, all claimed\n`,
    );
    process.exit(0);
  }
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.exit(1);
}

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

const cp = require("node:child_process");
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
  // Its own Go module with its own runner, called by the shim-audit lane. The
  // point of this map is to name who runs a suite, and something already did.
  "go:packages/ttsc/tools/shim_audit": "scripts/shim-audit-test.cjs",

  // ---- Go: the utility plugins and the rest ----
  "go:packages/banner/test": "scripts/test-go-utility-plugins.cjs",
  "go:packages/paths/test": "scripts/test-go-utility-plugins.cjs",
  "go:packages/strip/test": "scripts/test-go-utility-plugins.cjs",
  "go:packages/wasm/test/host": "scripts/test-go-wasm.cjs",
  "go:tests/go-transformer/transformer": "scripts/test-go-transformer.cjs",

  // ---- e2e workspace packages ----
  "e2e:tests/test-banner": "test.yml lane: package defenses",
  "e2e:tests/test-factory": "test.yml lane: factory",
  "e2e:tests/test-graph": "test.yml lane: graph",
  "e2e:tests/test-lint": "test.yml lanes: lint end-to-end defenses 1-4",
  "e2e:tests/test-metro": "test.yml lane: bundler defenses",
  "e2e:tests/test-paths": "test.yml lane: package defenses",
  "e2e:tests/test-playground": "test.yml lane: playground",
  "e2e:tests/test-strip": "test.yml lane: package defenses",
  "e2e:tests/test-ttsc":
    "test.yml lanes: ttsc core, plugin defenses, service defenses, watch",
  "e2e:tests/test-unplugin": "test.yml lane: bundler defenses",
  "e2e:tests/test-wasm": "test.yml lane: wasm",
  // Lives under experimental/, and is run by two workflows. Discovery read only
  // tests/ before, so this suite was invisible to the gate that certifies it.
  "e2e:experimental/test-unplugin":
    "test.yml lane: bundler defenses; bun.yml",

  // ---- node test files ----
  // Five of these ran only because scripts/test-go.cjs named them in a literal
  // `harnessTests` array. That array is the finite list this gate replaces, so
  // the files are claimed here and the array is derived from the claim.
  "node:packages/ttsc/scripts/check-flags.test.cjs":
    "test.yml lanes: typecheck, windows-go",
  "node:scripts/ci/dependency-audit.test.cjs": "test.yml lane: typecheck",
  "node:scripts/ci/factory-package.test.cjs": "test.yml lane: factory",
  "node:scripts/ci/line-endings.test.cjs": "test.yml lane: typecheck",
  "node:scripts/ci/test-owners.test.cjs": "test.yml lane: typecheck",
  "node:scripts/ci/validation-plan.test.cjs": "test.yml lane: typecheck",
  "node:scripts/ci/go-test-runners.test.cjs": "scripts/test-go.cjs harness",
  "node:scripts/ci/website-compiler-module.test.cjs":
    "scripts/test-go.cjs harness",
  "node:scripts/assert-project-layout.test.cjs": "scripts/test-go.cjs harness",
  "node:scripts/go-build-cache.test.cjs": "scripts/test-go.cjs harness",
  "node:scripts/go-build-cache-builders.test.cjs":
    "scripts/test-go.cjs harness",
  "node:website/test/rss-autodiscovery.test.cjs": "website postbuild",
  "node:website/test/typia-dependency-graph.test.cjs": "website postbuild",
};

/** The node suites `scripts/test-go.cjs` runs, derived from the claims above. */
const HARNESS_TESTS = Object.keys(OWNERSHIP)
  .filter((owner) => OWNERSHIP[owner] === "scripts/test-go.cjs harness")
  .map((owner) => owner.slice("node:".length))
  .sort();

/** Every `packages/lint/test/**` directory runs through one flattening runner. */
const LINT_GO_RUNNER = "scripts/test-go-lint.cjs";

/** Directories that hold e2e workspace packages named `test-*`. */
const E2E_ROOTS = ["tests", "experimental"];

/** Tracked roots that own node `*.test.cjs`/`*.test.mjs` suites. */
const NODE_TEST_ROOTS = ["scripts", "website", "packages"];

/**
 * Return the Git-tracked files that still exist in the worktree.
 *
 * `git ls-files` is the committed-owner boundary. Filtering missing paths keeps
 * an unstaged deletion visible as a stale claim, while ignored/generated
 * mirrors can never become owners merely because a build materialized them.
 * Failure is explicit outside a Git checkout: silently falling back to the
 * filesystem would change the meaning of "committed" based on environment.
 */
function trackedFiles() {
  const result = cp.spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `scripts/ci/test-owners.cjs: git ls-files failed; committed owner discovery requires a Git checkout:\n${result.stderr?.toString("utf8") ?? ""}`,
    );
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(root, file)));
}

/** Every committed executable test owner, derived from tracked files. */
function discoverOwners(files = trackedFiles()) {
  const owners = new Set();
  for (const file of files)
    if (
      file.endsWith("_test.go") &&
      (file.startsWith("packages/") || file.startsWith("tests/"))
    )
      owners.add(`go:${path.posix.dirname(file)}`);
  for (const dir of E2E_ROOTS)
    for (const file of files) {
      const [root_, packageName, child] = file.split("/");
      if (
        root_ === dir &&
        packageName?.startsWith("test-") &&
        child !== undefined
      )
        owners.add(`e2e:${dir}/${packageName}`);
    }
  for (const file of files)
    if (
      NODE_TEST_ROOTS.some((directory) => file.startsWith(`${directory}/`)) &&
      (file.endsWith(".test.cjs") || file.endsWith(".test.mjs"))
    )
      owners.add(`node:${file}`);
  return [...owners].sort();
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
function ownershipFailures(files) {
  const owners = discoverOwners(files);
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
  HARNESS_TESTS,
  OWNERSHIP,
  claimOf,
  discoverOwners,
  ownershipFailures,
  trackedFiles,
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

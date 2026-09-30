const fs = require("node:fs");
const path = require("node:path");

/**
 * The Node tests of the repository's own scripts, found by where they live,
 * and the lane that runs each (samchon/ttsc#1525).
 *
 * The Go runner and the validation plan used to name these tests one by one,
 * so a test added without editing a list ran nowhere and CI stayed green. They
 * are now discovered, and the directory a test lives in is its owner:
 *
 * - `scripts/*.test.cjs`: the Go runner harness and the Go build helpers, run
 *   first by `scripts/test-go.cjs` in both Go lanes (`go`).
 * - `scripts/ci/package/*.test.cjs`: checks that need the packed build, run by
 *   the `package-defenses` lane.
 * - `scripts/ci/*.test.cjs` and `packages/<name>/scripts/*.test.cjs`: the CI
 *   tooling's own tests and package build scripts' tests, run by the
 *   `typecheck` lane.
 * - `tests/unit/scripts/ci/*.test.cjs`: in-process tooling cases enrolled in
 *   the test contracts, also run by the `typecheck` lane.
 *
 * A `.test.cjs` anywhere else below `scripts/` belongs to no lane, and
 * discovery throws naming it, so it cannot be silently skipped.
 */
const NODE_TEST_OWNERS = [
  { lane: "go", pattern: /^tests\/unit\/scripts\/go\/[^/]+\.test\.cjs$/ },
  { lane: "typecheck", pattern: /^tests\/unit\/scripts\/ci\/[^/]+\.test\.cjs$/ },
  { lane: "go", pattern: /^scripts\/[^/]+\.test\.cjs$/ },
  { lane: "package-defenses", pattern: /^scripts\/ci\/package\/[^/]+\.test\.cjs$/ },
  { lane: "typecheck", pattern: /^scripts\/ci\/[^/]+\.test\.cjs$/ },
  { lane: "typecheck", pattern: /^packages\/[^/]+\/scripts\/[^/]+\.test\.cjs$/ },
];

// These tests exercise real process, launcher, formatter or packed-package
// boundaries. Keep their assertions in e2e even when Node's test runner owns them.
const E2E_NODE_TESTS = new Set([
  "scripts/format-go.test.cjs",
  "scripts/go-wasm-exec.test.cjs",
  "scripts/ci/feature-worker-isolation.test.cjs",
  "scripts/ci/gofmt-wrapper.test.cjs",
  "scripts/ci/typescript-loader.test.cjs",
  "scripts/ci/unit-source-loader.test.cjs",
  "scripts/ci/unplugin-test-contract.test.cjs",
  "packages/ttsc/scripts/check-flags.test.cjs",
]);

/** Classify observable process and package boundaries separately from units. */
function nodeTestLayer(relative) {
  return relative.startsWith("scripts/ci/package/") || E2E_NODE_TESTS.has(relative)
    ? "e2e"
    : "unit";
}

/** Select a test layer while retaining complete default local commands. */
function selectedNodeTests(root, lane, layer = process.env.TTSC_TEST_LAYER) {
  if (layer && layer !== "unit" && layer !== "e2e")
    throw new Error(`unknown TTSC_TEST_LAYER: ${layer}`);
  return discoverNodeTests(root, lane).filter(
    (file) => !layer || nodeTestLayer(file) === layer,
  );
}

/**
 * The lane that owns a Node test, by its repository-relative path with `/`
 * separators, or `undefined` for a path no owner claims.
 *
 * @param {string} relative
 * @returns {"go" | "package-defenses" | "typecheck" | undefined}
 */
function nodeTestLane(relative) {
  return NODE_TEST_OWNERS.find(({ pattern }) => pattern.test(relative))?.lane;
}

/**
 * Every Node test one lane runs, repository-relative with `/` separators, in
 * sorted order.
 *
 * @param {string} root The workspace root.
 * @param {"go" | "package-defenses" | "typecheck"} lane
 * @throws When a `.test.cjs` below `scripts/` belongs to no lane.
 */
function discoverNodeTests(root, lane) {
  const found = [];
  const walk = (relative) => {
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, relative), {
        withFileTypes: true,
      });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(child);
      } else if (entry.isFile() && entry.name.endsWith(".test.cjs")) {
        found.push(child);
      }
    }
  };
  walk("scripts");
  walk("tests/unit/scripts");
  for (const entry of fs.readdirSync(path.join(root, "packages"), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    for (const file of safeList(path.join(root, "packages", entry.name, "scripts")))
      if (file.endsWith(".test.cjs"))
        found.push(`packages/${entry.name}/scripts/${file}`);
  }
  const unowned = found.filter((file) => nodeTestLane(file) === undefined);
  if (unowned.length !== 0) {
    throw new Error(
      `no CI lane runs ${unowned.join(", ")}: move it under scripts/ (Go ` +
      `lanes), scripts/ci/package/ (package defenses), tests/unit/scripts/ci/ ` +
        `(units), or scripts/ci/ ` +
        `(typecheck), as scripts/ci/node-tests.cjs describes`,
    );
  }
  return found.filter((file) => nodeTestLane(file) === lane).sort();
}

function safeList(directory) {
  try {
    return fs.readdirSync(directory);
  } catch {
    return [];
  }
}

module.exports = {
  discoverNodeTests,
  nodeTestLane,
  nodeTestLayer,
  selectedNodeTests,
};

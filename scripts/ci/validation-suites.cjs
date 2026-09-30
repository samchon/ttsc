const fs = require('node:fs');
const path = require('node:path');
const { discoverNodeTests } = require('./node-tests.cjs');
const NODE_FLOOR = nodeFloor(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../packages/ttsc/package.json'), 'utf8')));

// Logical suites are batched inside one CI job; these never create matrix rows.
const LANES = [
  {
    "id": "packed-adapter",
    "run": "pnpm --dir experimental/test-unplugin start -- --pack-current"
  },
  {
    "id": "go",
    "run": "pnpm run test:go && pnpm --filter ttsc go:vet"
  },
  {
    "id": "go-race",
    "run": "node scripts/test-go-race.cjs"
  },
  {
    "id": "shim-audit",
    "run": "pnpm --filter ttsc shim:audit:test && pnpm --filter ttsc shim:audit"
  },
  {
    "id": "typecheck",
    "run": "node scripts/ci/run-typecheck-lane.cjs",
    "dirs": [
      "features"
    ]
  },
  {
    "id": "package-defenses",
    "run": `node --test ${discoverNodeTests(path.resolve(__dirname, '../..'), 'package-defenses').join(' ')} && pnpm --filter @ttsc/test-banner start && pnpm --filter @ttsc/test-paths start && pnpm --filter @ttsc/test-strip start && pnpm --filter @ttsc/test-playground start && pnpm --filter @ttsc/test-wasm start`
  },
  {
    "id": "ttsc-core",
    "run": "pnpm --filter @ttsc/test-ttsc start",
    "dirs": [
      "features/api",
      "features/compiler",
      "features/platform",
      "features/project",
      "features/tsgo",
      "features/ttscserver",
      "features/ttsx-runtime",
      "features/utility-plugins",
      "features/watch",
      "native-plugins/cli",
      "native-plugins/compiler",
      "native-plugins/corpus-source",
      "native-plugins/corpus-ttsc",
      "native-plugins/driver",
      "native-plugins/source-plugin"
    ]
  },
  {
    "id": "ttsc-native",
    "run": "pnpm --filter @ttsc/test-ttsc start",
    "dirs": [
      "native-plugins/corpus-misc",
      "native-plugins/server",
      "native-plugins/service",
      "native-plugins/service-incremental",
      "native-plugins/utility",
      "native-plugins/utility-host"
    ]
  },
  {
    "id": "runtime-node-floor",
    "run": "pnpm --filter @ttsc/test-ttsc start && node scripts/test-go-utility-plugins.cjs",
    "dirs": [
      "features/ttsx-runtime",
      "features/project",
      "native-plugins/utility"
    ],
    "node": NODE_FLOOR
  },
  {
    "id": "runtime-node-current",
    "run": "pnpm --filter @ttsc/test-ttsc start && node scripts/test-go-utility-plugins.cjs",
    "dirs": [
      "features/ttsx-runtime",
      "features/project",
      "native-plugins/utility"
    ],
    "node": "current"
  },
  {
    "id": "lint-1",
    "run": "pnpm --filter @ttsc/test-lint start",
    "dirs": [
      "features/config",
      "features/contributor",
      "features/plugin"
    ]
  },
  {
    "id": "lint-2",
    "run": "pnpm --filter @ttsc/test-lint start",
    "dirs": [
      "native-plugins/config",
      "native-plugins/fix",
      "native-plugins/format"
    ]
  },
  {
    "id": "bundler-defenses",
    "run": "pnpm --filter @ttsc/test-unplugin start && pnpm run experimental:unplugin-perf && pnpm --filter @ttsc/test-metro start",
    "dirs": [
      "features",
      "native-plugins"
    ]
  },
  {
    "id": "graph",
    "run": "pnpm --filter @ttsc/test-graph start"
  },
  {
    "id": "workspace-install",
    "run": "node scripts/ci/plugin-cache-persistence.mjs --pm=all"
  },
  {
    "id": "evidence",
    "run": "pnpm --filter @ttsc/benchmark-evidence run check && pnpm --filter test-evidence start && pnpm --filter test-evidence-benchmark start"
  }
];

/** Resolve suite commands once, merging directory selections per executor. */
function validationSteps(ids) {
  const steps = [];
  for (const id of ids) {
    const suite = LANES.find((entry) => entry.id === id);
    if (!suite) throw new Error('unknown validation lane: ' + id);
    for (const run of suite.run.split(' && ')) {
      const existing = steps.find((step) => step.run === run);
      if (existing) existing.dirs = [...new Set([...existing.dirs, ...(suite.dirs ?? [])])];
      else steps.push({run, dirs: [...(suite.dirs ?? [])]});
    }
  }
  return steps;
}

function nodeFloor(manifest) {
  const range = manifest.engines?.node;
  const match =
    typeof range === "string"
      ? /^>=\s*(\d+\.\d+\.\d+)$/.exec(range.trim())
      : null;
  if (match === null)
    throw new Error(
      `packages/ttsc/package.json engines.node must be a ">=major.minor.patch" floor, got ${JSON.stringify(range)}`,
    );
  return match[1];
}

module.exports = {LANES, NODE_FLOOR, validationSteps, nodeFloor};

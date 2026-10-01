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
    "id": "shim-audit",
    "run": "pnpm --filter ttsc shim:audit:test && pnpm --filter ttsc shim:audit"
  },
  {
    "id": "typecheck",
    "run": "node scripts/ci/run-typecheck-lane.cjs --boundaries-only",
    "dirs": [
      "features"
    ]
  },
  {
    "id": "package-defenses",
    "run": `node --test ${discoverNodeTests(path.resolve(__dirname, '../..'), 'package-defenses').join(' ')} && pnpm --filter @ttsc/test-banner-e2e start && pnpm --filter @ttsc/test-paths-e2e start && pnpm --filter @ttsc/test-strip-e2e start && pnpm --filter @ttsc/test-playground-e2e start && pnpm --filter @ttsc/test-wasm-e2e start`
  },
  {
    "id": "ttsc-core",
    "run": "pnpm --filter @ttsc/test-ttsc-e2e start",
    "dirs": [
      "features/api",
      "features/compiler",
      "features/native-plugins/compiler",
      "features/platform",
      "features/project",
      "features/source-plugin",
      "features/ttscserver",
      "features/ttsx-runtime",
      "features/utility-plugins",
      "features/watch",
      "features/native-plugins/corpus-source",
      "features/native-plugins/corpus-ttsc",
      "features/native-plugins/driver",
      "features/native-plugins/source-plugin"
    ]
  },
  {
    "id": "ttsc-native",
    "run": "pnpm --filter @ttsc/test-ttsc-e2e start",
    "dirs": [
      "features/native-plugins/corpus-misc",
      "features/native-plugins/server",
      "features/native-plugins/service",
      "features/native-plugins/service-incremental",
      "features/native-plugins/utility",
      "features/native-plugins/utility-host"
    ]
  },
  {
    "id": "runtime-node-floor",
    "run": "pnpm --filter @ttsc/test-ttsc-e2e start",
    "dirs": [
      "features/ttsx-runtime/node-compatibility"
    ],
    "node": NODE_FLOOR
  },
  {
    "id": "runtime-node-current",
    "run": "pnpm --filter @ttsc/test-ttsc-e2e start",
    "dirs": [
      "features/ttsx-runtime/node-compatibility"
    ],
    "node": "current"
  },
  {
    "id": "lint-1",
    "run": "pnpm --filter @ttsc/test-lint-e2e start",
    "dirs": [
      "features/config",
      "features/plugin"
    ]
  },
  {
    "id": "lint-2",
    "run": "pnpm --filter @ttsc/test-lint-e2e start",
    "dirs": [
      "features/native-plugins/config",
      "features/native-plugins/fix",
      "features/native-plugins/format"
    ]
  },
  {
    "id": "bundler-defenses",
    "run": "pnpm --filter @ttsc/test-unplugin-e2e start && pnpm run experimental:unplugin-perf && pnpm --filter @ttsc/test-metro-e2e start",
    "dirs": [
      "features",
      "features/native-plugins"
    ]
  },
  {
    "id": "graph",
    "run": "pnpm --filter @ttsc/test-graph-e2e start"
  },
  {
    "id": "workspace-install",
    "run": "node scripts/ci/plugin-cache-persistence.mjs --pm=all"
  },
  {
    "id": "evidence",
    "run": "pnpm --filter @ttsc/benchmark-evidence run check && pnpm --filter test-evidence-e2e start"
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

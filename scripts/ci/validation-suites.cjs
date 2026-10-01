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
    "run": `node --test ${discoverNodeTests(path.resolve(__dirname, '../..'), 'package-defenses').join(' ')} && pnpm --filter @ttsc/test-e2e start --package=banner && pnpm --filter @ttsc/test-e2e start --package=paths && pnpm --filter @ttsc/test-e2e start --package=strip && pnpm --filter @ttsc/test-e2e start --package=playground && pnpm --filter @ttsc/test-e2e start --package=wasm`
  },
  {
    "id": "ttsc-core",
    "run": "pnpm --filter @ttsc/test-e2e start --package=ttsc",
    "dirs": [
      "features/ttsc/api",
      "features/ttsc/compiler",
      "features/ttsc/native-plugins/compiler",
      "features/ttsc/platform",
      "features/ttsc/project",
      "features/ttsc/source-plugin",
      "features/ttsc/ttscserver",
      "features/ttsc/ttsx-runtime",
      "features/ttsc/utility-plugins",
      "features/ttsc/watch",
      "features/ttsc/native-plugins/corpus-source",
      "features/ttsc/native-plugins/corpus-ttsc",
      "features/ttsc/native-plugins/driver",
      "features/ttsc/native-plugins/source-plugin"
    ]
  },
  {
    "id": "ttsc-native",
    "run": "pnpm --filter @ttsc/test-e2e start --package=ttsc",
    "dirs": [
      "features/ttsc/native-plugins/corpus-misc",
      "features/ttsc/native-plugins/server",
      "features/ttsc/native-plugins/service",
      "features/ttsc/native-plugins/service-incremental",
      "features/ttsc/native-plugins/utility",
      "features/ttsc/native-plugins/utility-host"
    ]
  },
  {
    "id": "runtime-node-floor",
    "run": "pnpm --filter @ttsc/test-e2e start --package=ttsc",
    "dirs": [
      "features/ttsc/ttsx-runtime/node-compatibility"
    ],
    "node": NODE_FLOOR
  },
  {
    "id": "runtime-node-current",
    "run": "pnpm --filter @ttsc/test-e2e start --package=ttsc",
    "dirs": [
      "features/ttsc/ttsx-runtime/node-compatibility"
    ],
    "node": "current"
  },
  {
    "id": "lint-1",
    "run": "pnpm --filter @ttsc/test-e2e start --package=lint",
    "dirs": [
      "features/lint/config",
      "features/lint/plugin"
    ]
  },
  {
    "id": "lint-2",
    "run": "pnpm --filter @ttsc/test-e2e start --package=lint",
    "dirs": [
      "features/lint/native-plugins/config",
      "features/lint/native-plugins/fix",
      "features/lint/native-plugins/format"
    ]
  },
  {
    "id": "bundler-defenses",
    "run": "pnpm --filter @ttsc/test-e2e start --package=unplugin && pnpm run experimental:unplugin-perf && pnpm --filter @ttsc/test-e2e start --package=metro",
    "dirs": [
      "features/unplugin",
      "features/metro"
    ]
  },
  {
    "id": "graph",
    "run": "pnpm --filter @ttsc/test-e2e start --package=graph"
  },
  {
    "id": "workspace-install",
    "run": "node scripts/ci/plugin-cache-persistence.mjs --pm=all"
  },
  {
    "id": "evidence",
    "run": "pnpm --filter @ttsc/test-e2e start --package=evidence"
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

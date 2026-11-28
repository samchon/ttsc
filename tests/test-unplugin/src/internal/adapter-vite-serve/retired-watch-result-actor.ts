import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import type { TtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/TtscTransformCache";
import { evictGeneration } from "../../../../../packages/unplugin/src/core/transform/cache/evictGeneration";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { notifyWatchInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyWatchInputs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";
import { createViteServeWatchHooks } from "../../../../../packages/unplugin/src/core/vite/createViteServeWatchHooks";
import { waitFor } from "./waitFor";

const root = fs.realpathSync.native(process.argv[2]!);
const config = path.join(root, "tsconfig.json");
fs.writeFileSync(config, '{"include":["*.ts"]}');
const policy = readProjectMembershipPolicy(config);
let signal: ((event: string, file: string | null) => void) | undefined;
const watch = createViteServeInputWatch({
  watch(_root, listener) {
    signal = listener;
    return { close() {} };
  },
  poll: () => ({ close() {} }),
});
const invalidated = new Set<string>();
watch.attach({
  config: { root },
  moduleGraph: {
    getModulesByFile: (file) => new Set([{ file }]),
    invalidateModule: (node) =>
      invalidated.add(path.resolve((node as { file: string }).file)),
  },
});
const cache: TtscTransformCache = new Map();

function deliverAndEvict(index: number) {
  const key = `module-${index}.ts`;
  const choice = `candidate-${index}.d.ts`;
  const importer = path.join(root, key);
  const dependency = path.join(root, choice);
  fs.writeFileSync(importer, "export {};\n");
  fs.writeFileSync(dependency, "export {};\n");
  const result = {
    type: "success" as const,
    typescript: { [key]: `export const generation = ${index};` },
    graph: {
      edges: { [key]: [] },
      globals: [],
      configs: ["tsconfig.json"],
      candidates: { [key]: [choice] },
    },
    dependenciesComplete: [key],
  };
  const cached: TtscCachedProjectTransform = {
    inputHashes: {},
    membershipPolicy: policy,
    projectRoot: root,
    result,
    scratchDirectory: path.join(root, `disposed-${index}`),
    tsconfig: config,
  };
  const pending = Promise.resolve(cached);
  cache.set(config, pending);
  notifyWatchInputs(
    createViteServeWatchHooks("serve", true, watch, importer, watch.begin()),
    cached,
    importer,
    {
      consulted: [config],
      filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
      tsconfig: config,
    },
  );
  const state = envelopeDerivation(cached);
  assert.ok(state.graph);
  evictGeneration(cache, config, pending);
  return {
    importer,
    dependency,
    references: [
      new WeakRef(cached),
      new WeakRef(result),
      new WeakRef(state.graph.inputObservations),
    ],
  };
}

try {
  const deliveries = Array.from({ length: 8 }, (_, index) =>
    deliverAndEvict(index),
  );
  assert.equal(cache.size, 0);
  assert.ok(global.gc);
  for (let pass = 0; pass < 6; pass++) {
    await setImmediate();
    global.gc();
  }
  for (const { references, importer } of deliveries)
    for (const reference of references)
      assert.equal(reference.deref(), undefined, importer);

  const first = deliveries[0]!;
  fs.writeFileSync(first.dependency, "export const changed: number;\n");
  assert.ok(signal);
  signal("change", path.relative(root, first.dependency));
  await waitFor(
    () => invalidated.has(first.importer),
    "the retired generation's resolver input",
  );
  assert.deepEqual([...invalidated], [first.importer]);
} finally {
  await watch.dispose();
}

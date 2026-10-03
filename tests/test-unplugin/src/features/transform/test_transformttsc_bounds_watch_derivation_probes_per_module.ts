import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/TtscEnvelopeDerivation";
import { derivationIdentity } from "../../../../../packages/unplugin/src/core/transform/envelope/derivationIdentity";
import { deriveWatchInputs } from "../../../../../packages/unplugin/src/core/transform/envelope/deriveWatchInputs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { notifyWatchInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyWatchInputs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the six-module, 24-external watch union and its shared identity cost.
 *
 * A literal immutable envelope supplies the graph directly. The real path
 * identity context receives an explicit filesystem capability that counts and
 * delegates realpath; no filesystem method or private result registry is
 * patched. The first derivation prepares its indexes, then five sibling first
 * deliveries must stay within the original 24-probe-per-delivery bound.
 * Separate calls to notifyWatchInputs also verify the config-selection inputs
 * each host receives.
 *
 * 1. Author six fully connected modules, 24 external declarations and the
 *    universal inputs in a temporary filesystem corpus.
 * 2. Derive each module's watch inputs, counting native realpath calls after
 *    the first module prepares shared indexes.
 * 3. Check every watch-set member, the fixed sibling probe bound and the
 *    nearer configuration registered by the notification owner.
 *
 * @evidence contracts/testing.md#behavioral-verification Six source deriveWatchInputs calls must return the other five modules, 24 external declarations and universal producer inputs; six notifyWatchInputs calls additionally register the nearer config selection. The five sibling derivations average at most 24 actual realpath calls after first preparation.
 * @evidence contracts/testing.md#independent-expectations The test constructs a deliberate complete six-module graph and 24 named externals, then enumerates every expected path independently of the selection implementation. The fixed numeric bound is an operation count rather than elapsed time.
 * @evidence contracts/testing.md#distinguishing-cases Initial index construction is excluded while all five previously undelivered siblings are measured. Full watch-set assertions reject empty or partial derivations that would otherwise satisfy the cost bound; the nearer missing config must also be registered through the actual notification owner.
 * @evidence contracts/testing.md#execution-ownership The unit runner executes this source-only test with direct owner imports and a small temporary filesystem corpus. No compiler, plugin executable, built unplugin module or framework host runs; native generation delivery remains owned by the maintained delivery-pass E2E population.
 */
export function test_transformttsc_bounds_watch_derivation_probes_per_module(): void {
  const root = TestProject.tmpdir("ttsc-watch-derivation-unit-");
  const modules = Array.from({ length: 6 }, (_, index) => `src/mod${index}.ts`);
  const externals = Array.from(
    { length: 24 },
    (_, index) => `node_modules/dep${index}/index.d.ts`,
  );
  TestProject.writeFiles(root, {
    "package.json": '{"private":true}',
    "plugin.cjs": "module.exports = {};\n",
    "tsconfig.json": '{"include":["src"]}',
    ...Object.fromEntries(
      [...modules, ...externals].map((file) => [file, "export {};\n"]),
    ),
  });
  const source = path.join(root, "plugin-source");
  fs.mkdirSync(source);
  const result: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: Object.fromEntries(
      modules.map((file) => [file, "export {};\n"]),
    ),
    graph: {
      edges: Object.fromEntries(
        modules.map((file) => [
          file,
          [...modules.filter((other) => other !== file), ...externals],
        ]),
      ),
      globals: [],
      configs: ["tsconfig.json"],
    },
    hostInputs: ["package.json", "plugin.cjs", "tsconfig.json"],
    pluginSources: { [source]: "literal-source-input" },
  };
  let probes = 0;
  const identityContext = createHostPathIdentityContext({
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    realpath: (file) => {
      probes++;
      return fs.realpathSync.native(file);
    },
  });
  const state: TtscEnvelopeDerivation = {
    identityContext,
    identities: new Map(),
    project: { physical: identityContext.resolve(root).path, spelling: root },
    watchInputs: new Map(),
  };
  const expected = (file: string) =>
    [
      ...modules.filter((other) => other !== file),
      ...externals,
      "package.json",
      "plugin.cjs",
      "tsconfig.json",
    ]
      .map((input) => path.join(root, input))
      .concat(source)
      .sort();
  const observed = new Map<string, string[]>();
  for (const [index, file] of modules.entries()) {
    if (index === 1) probes = 0;
    const absolute = path.join(root, file);
    observed.set(
      file,
      deriveWatchInputs(
        state,
        { file: absolute, projectRoot: root, result },
        derivationIdentity(state, absolute),
      ),
    );
  }
  const perDelivery = probes / 5;
  assert.ok(
    perDelivery <= 24,
    `watch derivation re-probed the filesystem ${perDelivery.toFixed(1)} times per delivery (bound: 24)`,
  );
  const tsconfig = path.join(root, "tsconfig.json");
  const nearer = path.join(root, "src", "tsconfig.json");
  const cached = {
    inputHashes: {},
    membershipPolicy: readProjectMembershipPolicy(tsconfig),
    projectRoot: root,
    result,
    tsconfig,
  };
  for (const file of modules) {
    assert.deepEqual([...(observed.get(file) ?? [])].sort(), expected(file));
    const watched: string[] = [];
    notifyWatchInputs(
      { addWatchFile: (input) => watched.push(input) },
      cached,
      path.join(root, file),
      {
        consulted: [nearer, tsconfig],
        filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
        tsconfig,
      },
    );
    assert.deepEqual(watched.sort(), [...expected(file), nearer].sort());
  }
}

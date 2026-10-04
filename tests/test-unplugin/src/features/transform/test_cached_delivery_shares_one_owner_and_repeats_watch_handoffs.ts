import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";

/**
 * Verifies concurrent and repeated cached deliveries share one actual owner.
 *
 * The unresolved Promise is a supported cache input. Settling it supplies
 * literal consumer data, not a replacement compiler or a claimed native run.
 *
 * @evidence contracts/testing.md#behavioral-verification Six concurrent transformTtsc deliveries await the same current generation promise, return each literal output and retain that exact promise; repeated deliveries repeat the exact dependency and universal watch handoff without creating another owner.
 * @evidence contracts/testing.md#independent-expectations Six authored module names and PROBED output, the original promise identity and explicit types/package/plugin/config watch paths define every expected result. SHA-256 records actual host bytes only for fixture setup; no expected cache choice is computed by the production selector.
 * @evidence contracts/testing.md#distinguishing-cases An unresolved common owner contrasts with fulfilled and repeated deliveries. Each module has its own callback ledger, so one delivery cannot stand in for the other five, and repeated handoff must neither disappear nor accumulate extra paths. A separate supported generation returns identical authored source, contrasting changed output with undefined first/repeated delivery while preserving owner and watch handoff.
 * @evidence contracts/testing.md#execution-ownership This named unit calls the actual delivery coordinator in process over native fixture files and an authored protocol result. It performs no compiler, Go peer, native watcher or external host execution; native capture invocation counts and plugin output production are not certified here. Finally resets the owning cache.
 */
export async function test_cached_delivery_shares_one_owner_and_repeats_watch_handoffs(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const modules = Array.from({ length: 6 }, (_, index) => path.join(root, "src", "mod" + index + ".ts"));
  const code = 'export const value = "PROBED";\n';
  const dependency = path.join(root, "src", "types.d.ts");
  fs.writeFileSync(dependency, "export declare const typed: number;\n");
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}');
  fs.writeFileSync(path.join(root, "plugin.cjs"), "module.exports = () => {};\n");
  for (const file of modules) fs.writeFileSync(file, fixture.source);
  const hostInputs = ["package.json", "plugin.cjs", "tsconfig.json"].map((file) => path.join(root, file));
  const result = {
    type: "success" as const,
    typescript: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), code])),
    dependencies: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), ["src/types.d.ts"]])),
    hostInputs,
    hostInputHashes: Object.fromEntries(hostInputs.map((file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])),
    hostInputRealpaths: Object.fromEntries(hostInputs.map((file) => [file, fs.realpathSync.native(file)])),
  };
  const observed = observeValidationUnitGeneration(root, result);
  let settle!: (value: TtscCachedProjectTransform) => void;
  const owner = new Promise<TtscCachedProjectTransform>((resolve) => { settle = resolve; });
  fixture.cache.set(fixture.key, owner);
  const ledgers = modules.map(() => [] as string[]);
  const expected = [dependency, ...hostInputs].sort();
  const deliver = (file: string, index: number) => fixture.api.transformTtsc(
    file, fixture.source, fixture.options, undefined, fixture.cache,
    { addWatchFile: (input) => ledgers[index]!.push(input) },
  );
  try {
    const deliveries = modules.map(deliver);
    assert.equal(fixture.cache.size, 1);
    assert.equal(fixture.cache.get(fixture.key), owner);
    settle(observed);
    const outputs = await Promise.all(deliveries);
    assert.deepEqual(outputs.map((output) => output?.code), [code, code, code, code, code, code]);
    assert.equal(fixture.cache.get(fixture.key), owner);
    for (const ledger of ledgers) assert.deepEqual(ledger.sort(), expected);
    for (const ledger of ledgers) ledger.length = 0;
    const repeats = await Promise.all(modules.map(deliver));
    assert.deepEqual(repeats.map((output) => output?.code), [code, code, code, code, code, code]);
    assert.equal(fixture.cache.get(fixture.key), owner);
    for (const ledger of ledgers) assert.deepEqual(ledger.sort(), expected);
    const unchanged = observeValidationUnitGeneration(root, {
      ...result,
      typescript: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), fixture.source])),
    });
    const unchangedOwner = Promise.resolve(unchanged);
    fixture.cache.set(fixture.key, unchangedOwner);
    ledgers[0]!.length = 0;
    assert.equal(await deliver(modules[0]!, 0), undefined, "identical cached output leaves the host's source ownership intact");
    assert.equal(fixture.cache.get(fixture.key), unchangedOwner);
    assert.deepEqual(ledgers[0]!.sort(), expected);
    ledgers[0]!.length = 0;
    assert.equal(await deliver(modules[0]!, 0), undefined, "a repeated unchanged delivery stays a no-op");
    assert.equal(fixture.cache.get(fixture.key), unchangedOwner);
    assert.deepEqual(ledgers[0]!.sort(), expected);
  } finally {
    settle(observed);
    fixture.dispose();
  }
}

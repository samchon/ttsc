import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies a failing compile still registers the inputs a fix would touch, and
 * reports without terminal escapes (samchon/ttsc#1312).
 *
 * A successful delivery registers derived watch inputs, which is how a
 * type-only file no bundler graph contains still invalidates its dependants. A
 * failing one registered nothing, because the throw came before the
 * registration, so a watching session whose first compile failed had no channel
 * through which the fix could arrive. Its message also carried the host's raw
 * colour escapes, which obscure the file and line in an overlay or CI
 * annotation.
 *
 * 1. Deliver a healthy module and assert one batch of watch inputs carrying the
 *    generation's evidence.
 * 2. Break a declaration and deliver again, and assert the type error reaches the
 *    caller with one batch that includes the file the diagnostic names and
 *    claims no evidence.
 * 3. Assert the message carries no terminal escapes and still names that file.
 */
export async function test_transformttsc_a_failed_compile_watches_and_reports_plainly(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  const module = fixture.modules[0]!;

  const deliver = async (): Promise<{
    batches: number;
    error: Error | undefined;
    evidence: unknown[];
    watched: string[];
  }> => {
    const cache = api.createTtscTransformCache();
    api.beginTtscTransformBuild(cache);
    const watched: string[] = [];
    const evidence: unknown[] = [];
    let batches = 0;
    let error: Error | undefined;
    try {
      await api.transformTtsc(
        module,
        fs.readFileSync(module, "utf8"),
        options,
        undefined,
        cache,
        {
          addWatchFiles: (
            inputs: readonly { evidence?: unknown; file: string }[],
          ) => {
            batches += 1;
            for (const input of inputs) {
              watched.push(input.file);
              evidence.push(input.evidence);
            }
          },
        },
      );
    } catch (caught) {
      error = caught as Error;
    } finally {
      api.resetTtscTransformCache(cache);
    }
    return { batches, error, evidence, watched };
  };

  const healthy = await deliver();
  assert.equal(healthy.error, undefined, "the fixture must compile clean");
  assert.ok(
    healthy.watched.length > 0,
    "a healthy delivery registers its derived watch inputs",
  );
  assert.equal(
    healthy.batches,
    1,
    "watch inputs must be delivered in one batch",
  );
  assert.ok(
    healthy.evidence.some((supplied) => supplied !== undefined),
    "a healthy delivery supplies the generation's own recorded evidence",
  );
  assert.ok(
    healthy.evidence
      .filter((supplied) => supplied !== undefined)
      .every(
        (supplied) =>
          typeof (supplied as { missing?: unknown }).missing === "boolean",
      ),
    "watch evidence must preserve the public missing boolean for custom hosts",
  );
  assert.ok(
    healthy.evidence
      .filter((supplied) => supplied !== undefined)
      .every(
        (supplied) => (supplied as { state?: unknown }).state !== undefined,
      ),
    "a healthy watch input must carry the generation state used by Metro's run baseline",
  );

  // A genuine type error in an external declaration reached only through a
  // type import, so neither the project walk nor a bundler runtime graph can
  // carry the file whose repair must trigger the retry.
  const broken = fixture.declaration;
  fs.writeFileSync(
    broken,
    "export interface Shared { label: NotARealExternalType; }\n",
    "utf8",
  );
  const failed = await deliver();
  assert.ok(failed.error !== undefined, "a type error must reach the caller");
  assert.ok(
    failed.watched.length > 0,
    "a failed delivery must still register the inputs a fix would touch",
  );
  assert.equal(failed.batches, 1, "failed inputs must also use one batch");
  // Recovery graphs also contain absent resolution candidates. Only existing
  // inputs can be compared with the broken declaration by physical identity.
  assert.ok(
    failed.watched.some(
      (input) =>
        fs.existsSync(input) &&
        fs.realpathSync.native(input) === fs.realpathSync.native(broken),
    ),
    `the file the diagnostics name must be among them; watched: ${failed.watched.join(", ")}; error: ${JSON.stringify(failed.error.message)}`,
  );
  // No evidence, deliberately. A failed generation is replayed for the rest of
  // its pass without re-proving its inputs, so it cannot claim one of them
  // still exists; the adapter has to probe, which is also what routes a
  // deleted input to the poll that can notice it coming back.
  assert.ok(
    failed.evidence.every((supplied) => supplied === undefined),
    "a failed delivery must claim nothing about inputs it has not re-proven",
  );
  assert.ok(
    !failed.error.message.includes(String.fromCharCode(27)),
    `a surfaced message must carry no terminal escapes (got ${JSON.stringify(failed.error.message)})`,
  );
  assert.ok(
    failed.error.message.includes(path.basename(broken)),
    "and must still name the file the host reported",
  );

  // And the fix lands.
  fs.writeFileSync(
    broken,
    "export interface Shared { label: string; }\n",
    "utf8",
  );
  const recovered = await deliver();
  assert.equal(
    recovered.error,
    undefined,
    "the delivery must recover once the source is fixed",
  );
}

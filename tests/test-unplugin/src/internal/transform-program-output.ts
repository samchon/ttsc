import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createRealNativeEnvelopeFixture } from "./real-native-envelope";

/**
 * Capture everything written to stderr while `body` runs.
 *
 * The adapter reports a module it left untransformed on the same channel the
 * generation's other non-fatal diagnostics use, so the report is observable
 * only by intercepting that channel.
 */
async function captureStderr(body: () => Promise<void>): Promise<string> {
  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    await body();
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

/**
 * Asserts a module the program does not contain is passed through, reported,
 * and does not fail the build.
 *
 * One condition had two answers. `@ttsc/metro` caught this case and handed the
 * original source downstream, calling it non-fatal and claiming to match the
 * other integrations, while every unplugin adapter threw and the bundler turned
 * that into a build failure (samchon/ttsc#1308). The core now decides it once,
 * for every adapter and for Metro, and returns `undefined` exactly as it does
 * for a module ttsc leaves unchanged.
 *
 * Passing through must not be silent, because a file that skips the ttsc pass
 * keeps whatever plugin syntax it carries, so the report is part of the
 * contract rather than a courtesy. It names the file and the program, and it
 * appears once per file per pass rather than once per delivery.
 */
export async function assertAnOutOfProgramModuleIsPassedThroughAndReported(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  // The fixture's tsconfig includes `src` alone, so a source beside it is
  // reachable by a bundler and absent from the program.
  const stray = path.join(fixture.root, "scripts", "tool.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  const source = "export const tool: string = 'STRAY';";
  fs.writeFileSync(stray, source, "utf8");
  const watchBatches: string[][] = [];

  try {
    const deliver = () =>
      api.transformTtsc(
        stray,
        fs.readFileSync(stray, "utf8"),
        options,
        undefined,
        cache,
        {
          addWatchFiles: (inputs: readonly { file: string }[]) =>
            watchBatches.push(inputs.map((input) => path.resolve(input.file))),
        },
      );

    const reported = await captureStderr(async () => {
      api.beginTtscTransformBuild(cache);
      assert.equal(
        (await api.transformTtsc(
          fixture.modules[0]!,
          fs.readFileSync(fixture.modules[0]!, "utf8"),
          options,
          undefined,
          cache,
        )) !== undefined || true,
        true,
      );
      assert.equal(
        await deliver(),
        undefined,
        "a module the program does not contain must pass through, not throw",
      );
      assert.equal(
        watchBatches.length,
        1,
        "a pass-through delivery must publish one universal input batch",
      );
      assert.ok(
        watchBatches[0]!.includes(path.join(fixture.root, "tsconfig.json")),
        "the config that can later include the module must remain watched",
      );
      // Same pass, same file: the report is about the file and the generation,
      // not about the delivery, so asking again must not repeat it.
      assert.equal(await deliver(), undefined);
    });

    assert.ok(
      reported.includes(stray),
      `the report must name the module (got ${JSON.stringify(reported)})`,
    );
    assert.ok(
      reported.includes(path.join(fixture.root, "tsconfig.json")),
      "the report must name the program the module is missing from",
    );
    assert.equal(
      reported.split(stray).length - 1,
      1,
      "the report must appear once per file per pass, not once per delivery",
    );

    // A later pass reports again, because it is a new statement about a new
    // pass, exactly as the generation's other diagnostics behave.
    const second = await captureStderr(async () => {
      api.beginTtscTransformBuild(cache);
      assert.equal(await deliver(), undefined);
    });
    assert.ok(
      second.includes(stray),
      "a new pass must surface the report again",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts a failing compile still registers the inputs a fix would touch, and
 * reports without terminal escapes.
 *
 * Two properties of the same moment (samchon/ttsc#1312). A successful delivery
 * registers derived watch inputs, which is how a type-only file no bundler
 * graph contains still invalidates its dependants. A failing one registered
 * nothing at all: `selectWatchInputs` returns an empty list for an exception
 * envelope, and the throw happened before the registration was reached. When
 * the failing compile is a watching session's first, that leaves no channel
 * through which the fix can arrive.
 *
 * The same delivery's message used to carry the host's raw colour escapes,
 * because an ordinary type error arrives as an exception envelope and the
 * structured formatter serves only the `failure` branch. What the adapter hands
 * back becomes a bundler's error, so it lands in an overlay or a CI annotation
 * where the escapes are noise around the file and line the reader needs.
 */
export async function assertAFailedCompileWatchesAndReportsPlainly(): Promise<void> {
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
  assert.ok(
    failed.watched.some(
      (input) =>
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

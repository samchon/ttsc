import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runPooledWorker } from "../../internal/pooled-session/runPooledWorker";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies the worker processes of one pooled host session share a compile that
 * ended in diagnostics as they share a successful one (samchon/ttsc#1458).
 *
 * Only a successful compile was published to the session. Turbopack discards a
 * loader worker after a failed run and starts a fresh one for the next, so
 * every module of a broken project compiled the same broken state again in a
 * new process, once per module and per layer, and on a slow machine the page's
 * error outlasted the dev server's own patience: measured on the macOS x64
 * platform lane, where the Next contract's broken page never answered. The
 * diagnostics are a function of the state the publication is keyed by, so a
 * sibling worker adopts them as it adopts an envelope. An exception, which may
 * be a transient crash, is still each worker's own to retry.
 *
 * 1. Break a declaration so the compile ends in diagnostics, start one worker per
 *    module at once in a session, and assert every worker reports the
 *    diagnostic and the session holds one publication, the failed compile's.
 * 2. Start the workers again, and assert every worker reports the diagnostic while
 *    the publication is untouched: the broken state was adopted, not compiled
 *    again.
 * 3. Repair the declaration and repeat, and assert every worker is served and the
 *    repaired compile replaced the broken one in the session: the declaration
 *    is outside the project walk, so both name one state, and a worker that
 *    adopted the broken one found its proof gone and compiled.
 */
export async function test_transformttsc_pooled_workers_adopt_a_failed_compile(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-failure-");
  const options = { project: path.join(fixture.root, "tsconfig.json") };
  const wave = () =>
    Promise.all(
      fixture.modules.map((file) =>
        runPooledWorker({ file, options, session }),
      ),
    );

  const publications = () =>
    fs
      .readdirSync(session)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => ({
        mtimeMs: fs.statSync(path.join(session, name)).mtimeMs,
        name,
      }));

  const original = fs.readFileSync(fixture.declaration, "utf8");
  fs.writeFileSync(
    fixture.declaration,
    "export interface Shared { label: NotARealExternalType; }\n",
    "utf8",
  );
  for (const result of await wave()) {
    assert.equal(result.killed, false);
    assert.match(
      result.error ?? "",
      /NotARealExternalType/,
      `each worker reports the diagnostic: ${JSON.stringify(result)}`,
    );
  }
  const published = publications();
  assert.equal(published.length, 1, "the failed compile is published");

  for (const result of await wave()) {
    assert.match(result.error ?? "", /NotARealExternalType/);
  }
  assert.deepEqual(
    publications(),
    published,
    "the broken state is adopted, not compiled and published again",
  );

  fs.writeFileSync(fixture.declaration, original, "utf8");
  const third = await wave();
  for (const result of third) {
    assert.equal(result.error, undefined, result.error);
    assert.ok(result.code);
  }
  const republished = publications();
  assert.equal(republished.length, 1);
  assert.equal(
    (
      JSON.parse(
        fs.readFileSync(path.join(session, republished[0]!.name), "utf8"),
      ) as { result: { type: string } }
    ).result.type,
    "success",
    "the repaired compile replaced the broken one",
  );
}

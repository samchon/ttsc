import assert from "node:assert/strict";
import fs from "node:fs";

import { startViteAdapterSession } from "./internal/adapter-vite-lifecycle/startViteAdapterSession";
import { touchUnrelatedInput } from "./internal/adapter-vite-lifecycle/touchUnrelatedInput";

/**
 * Shares one watcherless native session between unseen and repeated deliveries.
 * The first delivery and one original plugin-input edit are common prerequisites.
 * Unseen modules retain the first generation; the repeated first module must
 * then replace it. Finally awaits the original buildEnd owner on every outcome.
 *
 * @evidence contracts/testing.md#behavioral-verification First delivery compiles once; all remaining successful deliveries after the plugin edit keep count1; repeating the first module after that same edit requires count2.
 * @evidence contracts/testing.md#independent-expectations Literal native run-log counts1/2 and successful transform values retain the two original owning bodies' observations rather than deriving expectations from callback success.
 * @evidence contracts/testing.md#distinguishing-cases Unseen delivery after an edit differs from a repeated delivery after the same edit, within one watcherless session.
 * @evidence contracts/testing.md#execution-ownership The shared Unplugin entry calls this explicit survivor; both original watcherless donor entries remain selected by the legacy tree. This authored body has not been executed.
 * @evidence contracts/e2e.md#necessary-boundary Built Vite hooks connect real native generation retention and replacement to authored module requests; a direct policy unit cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution One original four-module cache project, native plugin descriptor, watcherless session and first compile serve both original matrices; remaining and repeated requests still execute independently.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity No input is reset while the session runs. One original touch supplies both freshness contrasts. Finally awaits session.close on success or failure; the optional continuation runs only after successful assertions and close, then restores the captured original descriptor bytes before a new watching session. This modeled hook completion does not certify arbitrary descendant closure or live Vite server shutdown.
 * @evidence contracts/e2e.md#preserved-coverage Preserves test_vite_serve_without_a_watcher_takes_the_build_scoped_cache first/unseen count1 and test_vite_serve_without_a_watcher_revalidates_a_repeated_module repeated count2, including all successful delivery assertions and original plugin edit bytes. Actual remote coverage and donor removal remain pending.
 */
export async function runSharedWatcherlessViteDeliveries(
  afterClose?: (prepared: { root: string; runLog: string; originalPlugin: Buffer }) => Promise<void>,
): Promise<void> {
  const session = await startViteAdapterSession({ watching: false });
  let originalPlugin: Buffer | undefined;
  try {
    if (afterClose !== undefined)
      originalPlugin = fs.readFileSync(session.unrelatedInput);
    const first = session.modules[0]!;
    assert.ok(await session.deliver(first));
    assert.equal(session.projectCompiles(), 1);
    touchUnrelatedInput(session);
    for (const file of session.modules.slice(1))
      assert.ok(await session.deliver(file));
    assert.equal(
      session.projectCompiles(), 1,
      "a watcherless serve session must deliver every remaining module from the one generation it already compiled",
    );
    assert.ok(await session.deliver(first));
    assert.equal(
      session.projectCompiles(), 2,
      "a module delivered twice in one watcherless session must validate on its second delivery",
    );
  } finally {
    await session.close();
  }
  if (afterClose !== undefined && originalPlugin !== undefined)
    await afterClose({ ...session.project, originalPlugin });
}

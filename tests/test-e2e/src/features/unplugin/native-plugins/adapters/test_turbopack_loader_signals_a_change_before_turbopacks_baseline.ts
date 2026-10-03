import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { emitDependenciesPlugins } from "../../../../internal/unplugin/internal/adapter-turbopack/emitDependenciesPlugins";
import { projectRecordOf } from "../../../../internal/unplugin/internal/adapter-turbopack/projectRecordOf";
import { runTurbopackLoaderWithContext } from "../../../../internal/unplugin/internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies a change landing after the loader read an input, but before
 * Turbopack took its baseline, still re-runs the module (samchon/ttsc#1423).
 *
 * Turbopack takes a loader dependency's state as its baseline only when it
 * processes the loader's result. A change in between is part of that baseline,
 * so Turbopack's own channel never reported it, and the page kept the older
 * output. The bridge observes the input and moves the project's record,
 * repeatedly, until the module runs again.
 *
 * 1. Run the loader on the entry module, whose plugin reports `src/types.d.ts`.
 * 2. Edit the declaration at once, as Turbopack would still hold the result.
 * 3. Assert the record is moved, and moved again later, so one move lands after
 *    any baseline Turbopack takes.
 * 4. Run the loader again, which delivers the changed state, and assert the moves
 *    stop.
 *
 * @evidence contracts/testing.md#behavioral-verification Declaration edit moves the registered record twice; another delivery transforms and stops movement for five seconds.
 * @evidence contracts/testing.md#independent-expectations Changed declaration bytes require a new signal until consumed; fixed waits assert both ongoing and stopped notification.
 * @evidence contracts/testing.md#distinguishing-cases Initial registration, pre-baseline edit, repeated signal and acknowledgment on redelivery.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_signals_a_change_before_turbopacks_baseline is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built loader/native observer writes real records; actual Turbopack baseline timing is modelled by withholding redelivery.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone calls allocate the original empty-plugin root. Shared calls borrow that same config after preceding loader return, write the original Before declaration, then After, and require both repeated movement and five-second quiescence after redelivery. Only full successful body completion permits later baseline-config restoration; uncertain acknowledgment keeps those profiles blocked. Global loader observers remain process-owned rather than being falsely certified closed, and the shared root stays retained.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: declaration edit moves the registered record twice; another delivery transforms and stops movement for five seconds. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_turbopack_loader_signals_a_change_before_turbopacks_baseline(
  preparedRoot?: string,
): Promise<void> {
  const root = preparedRoot ?? TestUnpluginProject.createProject({ plugins: [] });
  const declaration = path.join(root, "src", "types.d.ts");
  fs.writeFileSync(declaration, "export type Before = string;\n");
  const run = () =>
    runTurbopackLoaderWithContext({
      resourcePath: TestUnpluginProject.mainFile(root),
      source: TestUnpluginProject.mainSource(root),
      options: { plugins: emitDependenciesPlugins(["src/types.d.ts"]) },
    });
  const first = await run();
  TestUnpluginProject.assertTransformedToPlugin(first.content);
  const record = projectRecordOf(root);
  assert.deepEqual(first.dependencies, [record]);
  const contents = () => fs.readFileSync(record, "utf8");
  // The contents once they differ from `previous`, or after 20 seconds.
  const changedFrom = async (previous: string): Promise<string> => {
    const deadline = Date.now() + 20_000;
    for (;;) {
      const current = contents();
      if (current !== previous || Date.now() > deadline) return current;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const baseline = contents();
  fs.writeFileSync(declaration, "export type After = number;\n");
  const rewritten = await changedFrom(baseline);
  assert.notEqual(rewritten, baseline, "the change moves the record");
  const repeated = await changedFrom(rewritten);
  assert.notEqual(repeated, rewritten, "the move repeats");

  const second = await run();
  TestUnpluginProject.assertTransformedToPlugin(second.content);
  const delivered = contents();
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  assert.equal(
    contents(),
    delivered,
    "a run that delivered the changed state stops them",
  );
}

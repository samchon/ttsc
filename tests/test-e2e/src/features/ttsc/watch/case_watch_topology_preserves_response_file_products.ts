import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../../utils/src/TestProject";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { waitFor } from "../../../internal/unplugin/internal/adapter-vite-serve/waitFor";

/**
 * Verifies response-selected native products agree with real watch delivery.
 * One copied project and observer lifetime carry the output move and reload.
 *
 * 1. Emit with the pinned unmodified compiler and observe the same response
 *    request through the built topology's native membership/OS subscriptions.
 * 2. Require former-output data and genuine source changes, while the actual
 *    response-selected JavaScript product stays quiet.
 * 3. Change the response, require config attention, and repeat the distinction
 *    with the new product and the former product now declared as data.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native TypeScript emits the literal selected/main.js and final/main.js products; shipped WatchTopology uses its real compiler-membership reader and OS watcher. Actual product writes stay out of the project lane while configured/data.md, source edits and response edits deliver their own kinds.
 * @evidence contracts/testing.md#independent-expectations Static config and response bytes name configured, selected and final output roles independently. The native producer must create the expected JavaScript before that path becomes a quiet control; literal event kind and physical target comparisons establish positive delivery.
 * @evidence contracts/testing.md#distinguishing-cases Configured outDir differs from the response-selected directory. A same-session response edit moves the product again, admitting the previous product as explicitly declared data. A genuine compiler source remains live. Units own ordered overrides, encoding/reset and malformed/changing-response matrices.
 * @evidence contracts/testing.md#execution-ownership The selected esbuild batch's existing observer worker calls this case with an upfront separate fixture. One topology lifetime and two ordinary native emit calls serve both states; native listFilesOnly refreshes remain real additional work and may recur on delivered directory events.
 * @evidence contracts/e2e.md#necessary-boundary Native response emission, native compiler membership and actual OS callback classification must agree. Supplied compiler-input and recorded-subscription units cannot prove this connection or that a real produced file stays quiet.
 * @evidence contracts/e2e.md#shared-execution No additional installation, worker or plugin build is introduced. The existing observer worker reuses the pinned compiler and its upfront graph; the response mutation requires another ordinary emit and membership refresh, not another preparation host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A separate copied native-response-topology root owns response/data/product mutations. Each native call returns ordinary completion and its PID departure is checked before the next mutation. Settled ledger boundaries distinguish each event; finally closes the one topology, and the existing parent joins worker departure before releasing the staged graph. close itself is not claimed to join backend handles.
 * @evidence contracts/e2e.md#preserved-coverage Existing topology corpus distinctions remain intact. This adds real response-selected products and config reload to the same observer owner; portable option combinations stay in test_watch_topology_preserves_response_file_output_options rather than multiplying native fixtures.
 */
export async function case_watch_topology_preserves_response_file_products(
  root: string,
): Promise<void> {
  const config = path.join(root, "tsconfig.json");
  const response = path.join(root, "flags.rsp");
  const source = path.join(root, "main.ts");
  const formerData = path.join(root, "configured/data.md");
  const selected = path.join(root, "selected/main.js");
  const final = path.join(root, "final/main.js");
  const binary = TestProject.TSGO_BINARY;
  const changes: WatchInputChange[] = [];
  const failures: unknown[] = [];
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 750));
  const capture = async (name: string, body: () => Promise<void>) => {
    try {
      await body();
      return true;
    } catch (cause) {
      failures.push(new Error(name, { cause }));
      return false;
    }
  };
  const blocked = (names: readonly string[], cause: unknown) => {
    for (const name of names)
      failures.push(new Error(name + " blocked", { cause }));
  };
  const distinctions = [
    "former configured output is data",
    "actual selected product stays quiet",
    "genuine compiler source remains live",
    "response edit reloads configuration",
    "actual final product stays quiet",
    "previous product is now declared data",
  ];
  const emit = (product: string) => {
    const receipt = E2eProcessTrace.spawnSync(
      binary,
      ["-p", config, "--pretty", "false", "@flags.rsp"],
      { cwd: root, env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.ok(isOrdinarilyClosedReadonlyLauncher(receipt));
    try {
      process.kill(receipt.pid, 0);
      assert.fail("native compiler PID remained live after completion");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    assert.equal(receipt.status, 0, receipt.stdout + receipt.stderr);
    assert.match(fs.readFileSync(product, "utf8"), /answer = 42/);
  };
  // Keep a native case witness in the future output directory before resolving
  // its missing product. This also prevents empty-directory probing on Windows.
  fs.mkdirSync(path.dirname(final));
  fs.writeFileSync(path.join(path.dirname(final), "CaseProof.txt"), "case proof");
  if (
    !(await capture("initial native product bootstrap", async () => {
      emit(selected);
      assert.equal(fs.existsSync(path.join(root, "configured/main.js")), false);
    }))
  ) {
    blocked(distinctions, failures[0]);
    throw new AggregateError(failures, "native response product bootstrap");
  }
  const topology = new WatchTopology(
    {
      binary,
      cwd: root,
      files: [],
      passthrough: ["@flags.rsp"],
      projectRoot: root,
      tsconfig: config,
    },
    {
      onError: (location, cause) =>
        failures.push(
          new Error("response topology error at " + location, { cause }),
        ),
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => undefined,
    },
  );
  const delivered = async (
    file: string,
    kind: WatchInputChange["kind"],
    stimulus: () => void,
  ) => {
    await settle();
    const before = changes.length;
    stimulus();
    await waitFor(
      () =>
        changes.slice(before).some((change) => {
          if (change.kind !== kind) return false;
          // Anonymous native attention still belongs to the asserted lane;
          // only this target changes after the settled ledger boundary.
          if (change.path === undefined) return true;
          if (!fs.existsSync(change.path)) return false;
          const changed = fs.realpathSync.native(change.path);
          const target = fs.realpathSync.native(file);
          if (changed === target) return true;
          if (kind !== "project" || !fs.statSync(change.path).isDirectory())
            return false;
          const relative = path.relative(changed, target);
          return (
            relative !== "" &&
            !path.isAbsolute(relative) &&
            relative !== ".." &&
            !relative.startsWith(".." + path.sep)
          );
        }),
      "response topology " + kind + ": " + file,
      30_000,
    );
    await settle();
  };
  const quietProduct = async (product: string) => {
    await settle();
    const before = changes.filter((change) => change.kind === "project").length;
    fs.appendFileSync(product, "\n// emitted product rewrite\n");
    await settle();
    assert.equal(
      changes.filter((change) => change.kind === "project").length,
      before,
      "actual response-selected product retriggered the project lane",
    );
  };
  try {
    if (
      !(await capture("initial native topology bootstrap", async () => {
        topology.refresh(false);
        topology.setProjectInputs({
          root,
          files: [formerData, selected, final],
          globs: [],
        });
      }))
    ) {
      blocked(distinctions, failures.at(-1));
    } else {
      await capture("former configured output is data", () =>
        delivered(formerData, "project", () =>
          fs.appendFileSync(formerData, "changed\n"),
        ),
      );
      await capture("actual selected product stays quiet", () =>
        quietProduct(selected),
      );
      await capture("genuine compiler source remains live", () =>
        delivered(source, "compiler", () =>
          fs.appendFileSync(source, "\n// source edit\n"),
        ),
      );
      await capture("response edit reloads configuration", () =>
        delivered(response, "config", () =>
          fs.writeFileSync(response, "--outDir final\n"),
        ),
      );
      const refreshed = await capture(
        "response-selected topology refresh",
        async () => topology.refresh(false),
      );
      const emitted = await capture("final native product bootstrap", async () =>
        emit(final),
      );
      if (refreshed && emitted)
        await capture("actual final product stays quiet", () =>
          quietProduct(final),
        );
      else blocked(["actual final product stays quiet"], failures.at(-1));
      if (refreshed)
        await capture("previous product is now declared data", () =>
          delivered(selected, "project", () =>
            fs.appendFileSync(selected, "\n// declared data\n"),
          ),
        );
      else blocked(["previous product is now declared data"], failures.at(-1));
    }
  } finally {
    try {
      topology.close();
    } catch (cause) {
      failures.push(new Error("response topology close failed", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "native response product distinctions");
}

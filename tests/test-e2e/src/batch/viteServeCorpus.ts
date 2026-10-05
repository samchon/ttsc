import { TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { test_vite_serve_keeps_compiler_inputs_out_of_runtime_imports } from "../features/unplugin/native-plugins/adapters/test_vite_serve_keeps_compiler_inputs_out_of_runtime_imports";
import { test_vite_serve_without_a_watcher_serves_the_startup_generation } from "../features/unplugin/native-plugins/adapters/test_vite_serve_without_a_watcher_serves_the_startup_generation";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Restore watching and watcherless development generations on one upfront
 * island.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Vite client/SSR requests preserve literal INITIAL/UPDATED/RECOVERED/RESTARTED, actual HMR recovery and zero runtime edges for compiler inputs; a later watch:null server returns unserved startup output after main changes.
 * @evidence contracts/testing.md#independent-expectations Original helper assertions use authored Secret literals and a resolver rejecting compiler inputs. The watcherless source/result shape independently requires its original generation.
 * @evidence contracts/testing.md#distinguishing-cases Client/SSR, external declaration/asset, deletion/failure/recreation/restart and watcherless immutable generation remain distinct actual paths.
 * @evidence contracts/testing.md#execution-ownership Selected Vite calls this body after its build/broker/observer finish. Two server acquisitions and one actual watching-server restart share one upfront island and source producer; native preparation counts are unmeasured.
 * @evidence contracts/e2e.md#necessary-boundary Native adapter delivery, real Vite environment graphs, kernel subscriptions and HMR socket notifications must agree. Source coordinator units do not prove those assemblies.
 * @evidence contracts/e2e.md#shared-execution Watching transitions share one server until the required restart. watch:null needs a different startup mode and follows its actual closure on the same island; no per-transition fixture/install/host is created.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original bytes restore only after real HMR client/server closure; unknown close or restoration failure retains shared inputs and forbids the next server. Body and close failures stay errors. Compiler caches are never deleted to manufacture reuse.
 * @evidence contracts/e2e.md#preserved-coverage Connects original valid serve/HMR and watch:null startup-generation assertions. Banner-shifted SSR stack attribution and missing-candidate resolution races remain separate unproved coverage.
 */
export async function viteServeCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/vite-serve");
  TestUnpluginProject.writePluginEntry(root);
  const original = new Map(
    [
      "src/main.ts",
      "src/secret.server.ts",
      "tsconfig.json",
      "rules.txt",
      "node_modules/types-only/index.d.ts",
    ].map((file) => [
      path.join(root, file),
      fs.readFileSync(path.join(root, file)),
    ]),
  );
  const failures: unknown[] = [];
  const restore = () => {
    const errors: unknown[] = [];
    for (const [file, bytes] of original)
      try {
        fs.writeFileSync(file, bytes);
      } catch (error) {
        errors.push(error);
      }
    try {
      const lazy = path.join(root, "src/lazy.ts");
      if (fs.existsSync(lazy)) fs.unlinkSync(lazy);
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) {
      BatchWorkspace.retain(
        "Vite serve input restoration failed after closure",
      );
      throw new AggregateError(errors, "Vite serve input restorations");
    }
  };
  for (const run of [
    test_vite_serve_keeps_compiler_inputs_out_of_runtime_imports,
    test_vite_serve_without_a_watcher_serves_the_startup_generation,
  ]) {
    let closed = false;
    try {
      await run(root, () => {
        closed = true;
      });
    } catch (error) {
      failures.push(error);
    }
    if (!closed) {
      BatchWorkspace.retain(
        "Vite serve session did not acknowledge all actual owned client/server closure",
      );
      break;
    }
    try {
      restore();
    } catch (error) {
      failures.push(error);
      break;
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "shared Vite development generations");
}

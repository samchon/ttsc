import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { test_vite_serve_keeps_compiler_inputs_out_of_runtime_imports } from "../features/unplugin/native-plugins/adapters/test_vite_serve_keeps_compiler_inputs_out_of_runtime_imports";
import { test_vite_serve_without_a_watcher_serves_the_startup_generation } from "../features/unplugin/native-plugins/adapters/test_vite_serve_without_a_watcher_serves_the_startup_generation";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Restore watching and watcherless development generations on one upfront
 * island.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Vite client/SSR requests preserve literal INITIAL/UPDATED/RECOVERED/RESTARTED, actual HMR recovery and zero runtime edges for compiler inputs. The same watching server executes an independently positioned authored throw after a real two-line native banner and must map its exact line/column. A later watch:null server returns unserved startup output after main changes.
 * @evidence contracts/testing.md#independent-expectations Original helper assertions use authored Secret literals and a resolver rejecting compiler inputs. The watcherless source/result shape independently requires its original generation.
 * @evidence contracts/testing.md#distinguishing-cases Client/SSR, external declaration/asset, deletion/failure/recreation/restart and watcherless immutable generation remain distinct actual paths.
 * @evidence contracts/testing.md#execution-ownership Selected Vite calls this body after its build/broker/observer finish. Two server acquisitions and one actual watching-server restart share one upfront island and an owning driver-backed Go fixture. That fixture replaces only goUpper calls and reports actually consumed helper/asset bytes; the compiler owns all other statements, maps and resolution observations. Missing-candidate proof adds an actual transform acquisition and two positive notification phases each join a fresh HMR client; native preparation counts are unmeasured.
 * @evidence contracts/e2e.md#necessary-boundary Native adapter delivery, real Vite environment graphs, kernel subscriptions and HMR socket notifications must agree. Source coordinator units do not prove those assemblies.
 * @evidence contracts/e2e.md#shared-execution Watching transitions share one server until the required restart. watch:null needs a different startup mode and follows its actual closure on the same island; no per-transition fixture/install/host is created.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original bytes restore only after real HMR client/server closure; unknown close or restoration failure retains shared inputs and forbids the next server. Body and close failures stay errors. Compiler caches are never deleted to manufacture reuse.
 * @evidence contracts/e2e.md#preserved-coverage Original serve/HMR INITIAL/UPDATED/recovery expectations remain while a real compiler retains the authored fail body, banner and maps. SSR/source-attribution and missing-candidate/type-root native proof are campaign strengthening beyond the old generic protocol producer. The watch:null twin corrupts the prepared main with an actual type error so fresh native compilation cannot masquerade as startup-generation reuse. These connections remain unexecuted until actual validation. No additional server or restart is created; actual new source preparation and native compilation remain costs.
 */
export async function viteServeCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/vite-serve");
  // This island requires the actual compiler's preamble, source maps and
  // resolution predicates. The generic protocol producer replaces the whole
  // source and cannot own those proofs or retain the authored throwing body.
  const descriptor = path.join(root, "plugin.cjs");
  const authoredDescriptor = fs.readFileSync(descriptor, "utf8");
  if (!authoredDescriptor.includes("__VITE_NATIVE_SOURCE__"))
    throw new Error("Vite native fixture must retain its authored source slot");
  fs.writeFileSync(
    descriptor,
    authoredDescriptor.replace(
      "__VITE_NATIVE_SOURCE__",
      JSON.stringify(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/unplugin/test/fixtures/vite-serve-module/serve-probe",
        ),
      ),
    ),
  );
  const original = new Map(
    [
      "src/main.ts",
      "plugin.cjs",
      "src/candidates.ts",
      "src/secret.server.ts",
      "packages/linked-pkg/index.js",
      "packages/linked-pkg/package.json",
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
      const candidate = path.join(root, "packages/linked-pkg/index.ts");
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
      const generated = path.join(root, "node_modules/@types/generated");
      if (fs.existsSync(generated)) fs.rmSync(generated, { recursive: true });
      const unrelated = path.join(
        path.dirname(root),
        "vite-serve-unrelated.ts",
      );
      if (fs.existsSync(unrelated)) fs.unlinkSync(unrelated);
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

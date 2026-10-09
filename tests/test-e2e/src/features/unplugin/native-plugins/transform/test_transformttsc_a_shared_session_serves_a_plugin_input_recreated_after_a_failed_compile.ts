import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadApi } from "../../../../internal/unplugin/internal/real-native-envelope/loadApi";

/**
 * Verifies the long-lived workers of one pooled host session serve a module
 * again once a file their linked plugin reads, deleted under the session and
 * compiled as missing, is recreated (samchon/ttsc#1458).
 *
 * A compile that ended in diagnostics is published to the session like one that
 * succeeded, and a worker adopts it for the state it names. The deleted state
 * and the recreated one are two states, so the publication of the first must
 * never answer for the second, in the worker that compiled it or in one that
 * adopted it. Measured with the host matrix's linked plugin, whose failure is a
 * diagnostics envelope; a source plugin's is an exception, which the session
 * never publishes.
 *
 * 1. Open two caches sharing one session, the way two compilers of one host do,
 *    deliver the entry through each in its own pass, and assert both serve the
 *    contract input's value.
 * 2. Delete the contract input, deliver through each in a new pass, and assert
 *    both fail naming it.
 * 3. Recreate it with a new value, deliver through each in a new pass, and assert
 *    both serve the new value.
 *
 * @evidence contracts/testing.md#behavioral-verification Two caches sharing a filesystem session first return FIRST, then both reject naming contract-input after deletion, then both return SECOND after recreation in new passes. This detects stale diagnostic publications surviving a changed linked-plugin input state.
 * @evidence contracts/testing.md#independent-expectations The contributor reads the literal ContractInput independently of program imports. FIRST/SECOND and the deleted-input diagnostic are fixture-defined outcomes, not derived from session keys. Both worker paths must observe each state, though this entry does not count capture sharing.
 * @evidence contracts/testing.md#distinguishing-cases Healthy source, deleted input diagnostic, and recreated different-valued input are checked in both the publishing and adopting cache. The input is read by the linked plugin rather than a runtime import, so module-only invalidation cannot pass.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_a_shared_session_serves_a_plugin_input_recreated_after_a_failed_compile owns two local public caches sharing a real linked-contributor session across input deletion/recreation. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary A real linked contributor returns diagnostics to filesystem session publication consumed by two public JS caches. Synthetic source-plugin exceptions do not cover native diagnostic publication or its adoption after input recreation.
 * @evidence contracts/e2e.md#shared-execution One fixed host-matrix contributor, shared native build cache, project and session store serve both cache owners and all three states. Separate caches are necessary to exercise publisher/adopter behavior; new passes change delivery identity without reinstalling the contributor.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique root/session paths prevent prior publications. Both caches keep the same options and session identity across explicit new passes; each deliver gathers results afresh and captures both errors before asserting. No explicit cache reset is present, so resources and temporary paths end with the runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_shared_session_serves_a_plugin_input_recreated_after_a_failed_compile; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_shared_session_serves_a_plugin_input_recreated_after_a_failed_compile(): Promise<void> {
  TestUnpluginProject.ensureSharedCacheDir();
  const api = await loadApi();
  const root = TestProject.tmpdir("ttsc-unplugin-session-recreated-");
  const session = TestProject.tmpdir("ttsc-unplugin-session-store-");
  // The host matrix's linked plugin, the one contributor that reads a file the
  // program does not import.
  const contributor = path.resolve(
    import.meta.dirname,
    "../../../../../../experimental/test-unplugin/assets/linked/contract",
  );
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({ private: true, type: "module" }),
    "plugin.cjs": `module.exports = () => ({ name: "contract", source: ${JSON.stringify(contributor)} });\n`,
    "src/contract-input.server.ts": 'export type ContractInput = "FIRST";\n',
    "src/globals.d.ts": "declare function watchValue(): string;\n",
    "src/main.ts": "export const value = watchValue();\n",
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        plugins: [{ transform: "./plugin.cjs" }],
        target: "ES2022",
        types: [],
      },
      include: ["src"],
    }),
  });
  const entry = path.join(root, "src", "main.ts");
  const input = path.join(root, "src", "contract-input.server.ts");
  const options = api.resolveOptions({
    project: path.join(root, "tsconfig.json"),
  });
  const caches = [
    api.createTtscTransformCache(),
    api.createTtscTransformCache(),
  ];
  for (const cache of caches) api.shareTtscTransformCache(cache, session);
  const deliver = async (): Promise<(string | Error)[]> => {
    const results: (string | Error)[] = [];
    for (const cache of caches) {
      api.beginTtscTransformBuild(cache);
      try {
        const result = await api.transformTtsc(
          entry,
          fs.readFileSync(entry, "utf8"),
          options,
          undefined,
          cache,
        );
        results.push(result?.code ?? "");
      } catch (error) {
        results.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return results;
  };

  for (const result of await deliver()) {
    assert.ok(typeof result === "string", String(result));
    assert.match(result, /"FIRST"/);
  }

  fs.rmSync(input);
  for (const result of await deliver()) {
    assert.ok(result instanceof Error, "the deleted input fails the compile");
    assert.match(result.message, /contract-input/);
  }

  fs.writeFileSync(input, 'export type ContractInput = "SECOND";\n');
  for (const result of await deliver()) {
    assert.ok(
      typeof result === "string",
      `the recreated input is served: ${String(result)}`,
    );
    assert.match(result, /"SECOND"/);
  }
}

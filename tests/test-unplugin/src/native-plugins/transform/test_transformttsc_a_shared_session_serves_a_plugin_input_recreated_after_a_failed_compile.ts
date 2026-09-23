import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadApi } from "../../internal/real-native-envelope/loadApi";

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
    "../../../../../experimental/test-unplugin/assets/linked/contract",
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

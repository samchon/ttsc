import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadApi } from "../../internal/real-native-envelope/loadApi";

/**
 * Verifies a pooled host session never publishes a compile whose graph proof
 * failed on the worker that made it, so the retry compiles instead of adopting
 * the same failed state back (samchon/ttsc#1468).
 *
 * A compile is published under the project state it read, and the walk that
 * names that state leaves the project's dot directories out. A plugin that
 * writes below the project root while it runs, the host matrix's linked plugin
 * among them, changes the root's listing the compiler observed, which the graph
 * proof rejects after the compile: the attempt is unstable and retried.
 * Published anyway, since the walk itself held still, that envelope was what
 * the retry adopted for the same state, and what every other worker adopted, so
 * a session's first compile of a fresh project failed on every worker after its
 * bounded attempts. Measured with Next's Turbopack workers on the restart
 * contract, whose first session opens on a project the plugin has never written
 * into.
 *
 * 1. Open a cache sharing a session on a fresh project the linked plugin has not
 *    written into, and deliver the entry.
 * 2. Assert the delivery serves the value, and that the project compiled twice:
 *    the compile the plugin's write made unstable, and the retry the session
 *    did not answer from that compile.
 */
export async function test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed(): Promise<void> {
  TestUnpluginProject.ensureSharedCacheDir();
  const api = await loadApi();
  const root = TestProject.tmpdir("ttsc-unplugin-session-unpublished-");
  const session = TestProject.tmpdir("ttsc-unplugin-session-store-");
  // The host matrix's linked plugin, which appends to `.ttsc/contract-runs`
  // below the project while it runs.
  const contributor = path.resolve(
    import.meta.dirname,
    "../../../../../experimental/test-unplugin/assets/linked/contract",
  );
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({ private: true, type: "module" }),
    "plugin.cjs": `module.exports = () => ({ name: "contract", source: ${JSON.stringify(contributor)} });\n`,
    "src/contract-input.server.ts": 'export type ContractInput = "FIRST";\n',
    "src/globals.d.ts": "declare function watchValue(): string;\n",
    // A package import makes the compiler list the project root while it
    // resolves, as the host matrix's Next page importing React does.
    "node_modules/pkg/index.d.ts": "export type Value = string;\n",
    "node_modules/pkg/package.json": JSON.stringify({
      name: "pkg",
      types: "index.d.ts",
    }),
    "src/main.ts":
      'import type { Value } from "pkg";\nexport const value: Value = watchValue();\n',
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
  assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
  const entry = path.join(root, "src", "main.ts");
  const options = api.resolveOptions({
    project: path.join(root, "tsconfig.json"),
  });
  const cache = api.createTtscTransformCache();
  api.shareTtscTransformCache(cache, session);
  api.beginTtscTransformBuild(cache);
  const result = await api.transformTtsc(
    entry,
    fs.readFileSync(entry, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.match(result?.code ?? "", /"FIRST"/, "the entry is served");
  assert.equal(
    fs.statSync(path.join(root, ".ttsc", "contract-runs")).size,
    2,
    "the compile the plugin's write made unstable, and the retry",
  );
}

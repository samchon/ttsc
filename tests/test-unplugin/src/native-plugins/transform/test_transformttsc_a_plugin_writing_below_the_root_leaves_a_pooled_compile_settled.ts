import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadApi } from "../../internal/real-native-envelope/loadApi";

/**
 * Verifies a plugin that writes below the project root while it compiles leaves
 * a pooled compile settled: compiled once, published, and adopted by the next
 * worker of the session.
 *
 * The compiler expands the config's file list from the project root, and its
 * observer keeps that listing on the root once the root is also a module
 * resolution candidate, as it is when a source imports a package. A plugin
 * appending to a run log below the root, the host matrix's linked plugin among
 * them, creates the root's tool directory during the first compile, and proving
 * the raw listing failed that compile: every worker of a fresh session then
 * compiled the project again. The root's listing is the program's membership
 * there, which the walk proves, and the walk leaves the tool directory out.
 *
 * 1. Open a cache sharing a session on a fresh project the linked plugin has not
 *    written into, and deliver the entry.
 * 2. Assert the entry is served from one compile.
 * 3. Deliver it again from a second cache of the same session, as another worker
 *    does, and assert it adopted the first compile's publication.
 */
export async function test_transformttsc_a_plugin_writing_below_the_root_leaves_a_pooled_compile_settled(): Promise<void> {
  TestUnpluginProject.ensureSharedCacheDir();
  const api = await loadApi();
  const root = TestProject.tmpdir("ttsc-unplugin-session-settled-");
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
    // A package import makes the project root a resolution candidate, as the
    // host matrix's Next page importing React does.
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
  const compiles = () =>
    fs.statSync(path.join(root, ".ttsc", "contract-runs")).size;
  const deliver = async () => {
    const cache = api.createTtscTransformCache();
    api.shareTtscTransformCache(cache, session);
    api.beginTtscTransformBuild(cache);
    return api.transformTtsc(
      entry,
      fs.readFileSync(entry, "utf8"),
      options,
      undefined,
      cache,
    );
  };

  assert.match((await deliver())?.code ?? "", /"FIRST"/, "the entry is served");
  assert.equal(compiles(), 1, "from one compile, the plugin's write aside");
  assert.match((await deliver())?.code ?? "", /"FIRST"/);
  assert.equal(compiles(), 1, "which the next worker adopts");
}

import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadApi } from "../../../internal/real-native-envelope/loadApi";

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
 *
 * @evidence contracts/testing.md#behavioral-verification A linked contributor creates .ttsc/contract-runs during the first pooled delivery; output must contain FIRST and count one capture. A second cache sharing the session must return FIRST with the count still one, proving publication survives non-input root churn and is adopted.
 * @evidence contracts/testing.md#independent-expectations The fixture ContractInput is literally FIRST and the contributor independently appends a byte per Program. Creating the tool directory cannot alter admitted source membership; output and literal count require usable publication rather than merely a settled flag. The absent .ttsc baseline is deliberate cold input, not a committed arrangement assertion.
 * @evidence contracts/testing.md#distinguishing-cases Cold first capture creates a non-input tool directory below a root also used as a package resolution candidate; a separate cache is the adoption control. The graph-proof-failure pooled entry owns a compile that must not be published.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_plugin_writing_below_the_root_leaves_a_pooled_compile_settled in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary Actual linked native contributor, compiler root proofs and filesystem session publication connect two JS caches. A fabricated graph cannot expose the native root-listing side effect or show another cache adopts its publication.
 * @evidence contracts/e2e.md#shared-execution The fixed host-matrix contributor and suite native build cache are reused. One fresh project/session store serve two distinct caches; two caches are necessary to test adoption while one actual compilation is required and asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique project and session-store directories guarantee no prior publication or tool directory. Per-delivery caches share only that intended session identity. The helper does not explicitly reset those caches; build-pass state and directory resources remain bounded by runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_plugin_writing_below_the_root_leaves_a_pooled_compile_settled; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * A check plugin must use ttsx's private layout root for a noEmit project.
 * The imported source is outside the config directory, while a declared
 * restrictive root remains a genuine compiler error.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsx and the workspace lint check host execute a sibling import under an implicit root, then report TS6059 for an explicit restrictive root.
 * @evidence contracts/testing.md#independent-expectations The authored sibling exports 17; the positive run must print 17, and the explicit root excludes the sibling by its authored path.
 * @evidence contracts/testing.md#distinguishing-cases The same noEmit project contrasts an implicit private root with an explicit config-directory root through the native check host.
 * @evidence contracts/testing.md#execution-ownership The E2E scenarios batch registers this named export; TestProject owns the temporary project and synchronous launcher children.
 * @evidence contracts/e2e.md#necessary-boundary The failure arose when launcher JSON arguments reached a real native plugin Program; argv units cannot establish the compiler diagnostic or runtime result.
 * @evidence contracts/e2e.md#shared-execution Both runs use one authored project and the suite-owned plugin cache, while each launcher receives a fresh Program.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project and junction are temporary; the shared cache is only selected, not deleted. Each child settles before the config changes.
 * @evidence contracts/e2e.md#preserved-coverage This new case complements existing noEmit plugin and forwarded-root tests without replacing their assertions.
 */
export function test_plugin_corpus_ttsx_check_host_accepts_sibling_sources_without_rootdir(): void {
  const root = TestProject.createProject({
    "sibling/value.ts": "export const value = 17;\n",
    "test/src/index.ts":
      'import { value } from "../../sibling/value.ts"; console.log(value);\n',
    "test/lint.config.json": '{"rules":{}}\n',
  });
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  fs.symlinkSync(
    path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
    path.join(linkDir, "lint"),
    "junction",
  );
  const tsconfig = path.join(root, "test", "tsconfig.json");
  const compilerOptions = {
    target: "ES2022",
    module: "CommonJS",
    noEmit: true,
    allowImportingTsExtensions: true,
    rewriteRelativeImportExtensions: true,
    plugins: [{ transform: "@ttsc/lint" }],
  };
  const run = () =>
    TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--project", tsconfig, path.join(root, "test", "src", "index.ts")],
      {
        cwd: root,
        env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
      },
    );
  fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions, include: ["src"] }));
  const implicit = run();
  assert.equal(implicit.status, 0, implicit.stderr);
  assert.equal(implicit.stdout.trim(), "17");

  fs.writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: { ...compilerOptions, rootDir: "." },
      include: ["src"],
    }),
  );
  const explicit = run();
  assert.notEqual(explicit.status, 0);
  assert.match(`${explicit.stdout}${explicit.stderr}`, /TS6059/);
}

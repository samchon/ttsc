import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { positionOf } from "../../../internal/source-map/positionOf";
import { createLinkedPluginProject } from "../../../internal/transform-linked-completeness/createLinkedPluginProject";

const viteCreateServer =
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").createServer;

/**
 * Verifies a Vite dev server reports an error thrown in a ttsc-transformed
 * module at the line its author wrote (samchon/ttsc#1392).
 *
 * Vite's module runner maps a server-side stack trace through each module's
 * combined source map. Without the adapter's map, the frames of a module
 * `@ttsc/banner` shifted point at the transformed lines, and so do breakpoints
 * and the error overlay.
 *
 * 1. Add a throwing function to a banner project's entry, build its linked host
 *    ahead of the dev server, whose module fetch times out after a minute, and
 *    load the entry through the server.
 * 2. Call the function and assert its frame names the entry at the throw's
 *    authored line and column.
 *
 * @evidence contracts/testing.md#behavioral-verification Real server ssrLoadModule executes banner-shifted fail and its stack names authored new Error line and column.
 * @evidence contracts/testing.md#independent-expectations positionOf reads original source, independently of returned source map or mapped stack.
 * @evidence contracts/testing.md#distinguishing-cases Banner shifts throw position, stack maps it back; bundle map cases cover other hosts.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_reports_errors_at_the_authored_line is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite SSR runner composes adapter maps into runtime error frames.
 * @evidence contracts/e2e.md#shared-execution One server and fixture serve requests and mutations, with replacement only for restart assertions; shared native artifacts do not replace the cold request.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Server closes in finally on success/failure; restart reuses only this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: real server ssrLoadModule executes banner-shifted fail and its stack names authored new Error line and column. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_reports_errors_at_the_authored_line(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const project = createLinkedPluginProject(["banner"]);
  const source = `${fs.readFileSync(project.main, "utf8")}export function fail(): never {\n  throw new Error("authored");\n}\n`;
  fs.writeFileSync(project.main, source, "utf8");
  assert.ok(
    await api.transformTtsc(
      project.main,
      source,
      api.resolveOptions(),
      undefined,
      undefined,
    ),
  );
  const server = await viteCreateServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: project.root,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  try {
    const entry = await server.ssrLoadModule("/src/main.ts");
    let stack = "";
    try {
      entry.fail();
    } catch (error) {
      stack = (error as Error).stack ?? "";
    }
    const thrown = positionOf(source, "new Error");
    assert.match(
      stack,
      new RegExp(`main\\.ts:${thrown.line + 1}:${thrown.column + 1}\\b`),
    );
  } finally {
    await server.close();
  }
}

import assert from "node:assert/strict";
import path from "node:path";

import { eventually, expectOutput, fixture, write } from "../common.mjs";

/**
 * Verifies React Router accepts an erased server-only type import and invalidates transformed output.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Actual Vite plus reactRouter transforms the route to FIRST, then SECOND and THIRD after edits; an invalid contract type must reject. The route module graph must not retain contract-input.server as a runtime import.
 * @evidence contracts/testing.md#independent-expectations
 *   The authored type-only import must be erased before the framework server-module guard, and literal input values define output. The broken type is independently invalid and its compiler diagnostic is matched.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers initial transformation, type-only invalidation, compiler failure and repair, plus absence of a runtime server-module graph edge. These distinguish successful transformation from silently ignored framework guards.
 * @evidence contracts/testing.md#execution-ownership
 *   The react-router worker calls this named E2E entry directly. Each original module graph, output and rejection assertion remains; source adapter units do not execute this framework plugin composition.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Real React Router guards run after actual Vite transformation. Ordinary Vite watch and source transform units cannot prove the framework sees erased imports rather than the original type-only server reference.
 * @evidence contracts/e2e.md#shared-execution
 *   One existing Vite server, project and shared installed producer serve all edits and failure/recovery; no server or compilation fixture is created separately for each assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   The dedicated React Router fixture isolates config and route graph. The original cwd is restored and the actual Vite server closes in finally, including transform rejection or assertion failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   Every original FIRST/SECOND/THIRD, module graph invalidation, forbidden server import and invalid-contract rejection assertion remains in this body. Extraction changes only its callable name and relative helper import.
 */

export async function test_host_react_router_erases_server_type_import() {
  const { createServer } = await import("vite");
  const project = fixture("react-router");
  write(
    project.root,
    "app/root.tsx",
    'import { Outlet } from "react-router"; export default function Root() { return <html><body><Outlet /></body></html>; }',
  );
  write(
    project.root,
    "app/entry.server.tsx",
    'import { renderToString } from "react-dom/server"; import { ServerRouter } from "react-router"; export default function handleRequest(request, status, headers, context) { headers.set("Content-Type", "text/html"); return new Response("<!DOCTYPE html>" + renderToString(<ServerRouter context={context} url={request.url} />), { status, headers }); }',
  );
  write(
    project.root,
    "app/routes.ts",
    'import { index } from "@react-router/dev/routes"; export default [index("routes/home.tsx")];',
  );
  write(
    project.root,
    "app/routes/home.tsx",
    'import type { ContractInput } from "../../src/contract-input.server"; export default function Home() { const value: ContractInput = watchValue(); return <p>{value}</p>; }',
  );
  write(
    project.root,
    "vite.config.mjs",
    [
      'import ttsc from "@ttsc/unplugin/vite";',
      'import { reactRouter } from "@react-router/dev/vite";',
      `export default { plugins: [ttsc(${JSON.stringify(project.options)}), reactRouter()] };`,
    ].join("\n"),
  );
  const before = process.cwd();
  process.chdir(project.root);
  let server;
  try {
    server = await createServer({
      root: project.root,
      configFile: path.join(project.root, "vite.config.mjs"),
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      server: { middlewareMode: true, hmr: false },
    });
    const url = "/app/routes/home.tsx";
    expectOutput((await server.transformRequest(url)).code, "FIRST");
    const node =
      await server.environments.client.moduleGraph.getModuleByUrl(url);
    project.change("SECOND");
    await eventually(
      () => !node.transformResult,
      Boolean,
      "React Router dependency invalidation",
    );
    expectOutput((await server.transformRequest(url)).code, "SECOND");
    assert.ok(
      [...node.importedModules].every(
        (entry) => !entry.id.includes("contract-input.server"),
      ),
    );
    project.break();
    await eventually(
      () => !node.transformResult,
      Boolean,
      "React Router failed-input invalidation",
    );
    await assert.rejects(server.transformRequest(url), /invalid contract type/);
    project.change("THIRD");
    expectOutput((await server.transformRequest(url)).code, "THIRD");
  } finally {
    await server?.close();
    process.chdir(before);
  }
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveGraphBinary } from "../../../../packages/graph/src/resolveGraphBinary";
import { TtscGraphSession } from "../../../../packages/graph/src/model/TtscGraphSession";

/**
 * Verifies binary lookup and lazy session construction use their target cwd.
 *
 * The resolver interprets a package-shaped filesystem fixture. Its binary
 * pathname is inert and is never executed: module resolution and constructor
 * preconditions need no compiler build or process to prove these controls.
 *
 * 1. Resolve the target peer path and contrast an uninstalled root.
 * 2. Check absolute override precedence, ignored relative override and default cwd.
 * 3. Construct and close a lazy target session; require the owned missing error from its uninstalled twin.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored resolveGraphBinary resolves the fixture peer path, returns null without a peer, honors absolute override, ignores relative override and uses default process cwd; authored lazy Session construction resolves that target and closes without opening a native peer.
 * @evidence contracts/testing.md#independent-expectations Literal installed path, null and override values independently define precedence. Missing-session error is a literal contract and zero peer ownership is observed without deriving expected results from lookup.
 * @evidence contracts/testing.md#distinguishing-cases Installed versus absent peer, explicit versus default cwd, absolute versus relative override and resolver versus lazy constructor retain all original pure controls. Real executing facade connections are preserved in the installed native boundary.
 * @evidence contracts/testing.md#execution-ownership This src/unit export imports authored resolver and facade source under their actual CommonJS mode. A real temporary package layout supplies module-resolution inputs; its inert file is never installed as a consumer, built or executed, and session construction starts no host.
 */
export async function test_ttscgraph_dump_resolves_binary_from_target_cwd(): Promise<void> {
  const root = TestProject.tmpdir("ttscgraph-resolver-source-");
  const empty = TestProject.tmpdir("ttscgraph-uninstalled-source-");
  const platform = `${process.platform}-${process.arch}`;
  const platformDir = path.join(root, "node_modules", "@ttsc", platform);
  const binary = path.join(platformDir, "bin", process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph");
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, "inert module-resolution input; never executed");
  fs.writeFileSync(path.join(platformDir, "package.json"), JSON.stringify({ name: `@ttsc/${platform}`, version: "0.0.0" }));
  const ttscDir = path.join(root, "node_modules", "ttsc");
  fs.mkdirSync(ttscDir, { recursive: true });
  fs.writeFileSync(path.join(ttscDir, "package.json"), '{"name":"ttsc","version":"0.0.0"}');
  const resolved = resolveGraphBinary({}, root);
  assert.ok(resolved !== null);
  assert.equal(fs.realpathSync(resolved), fs.realpathSync(binary));
  assert.equal(resolveGraphBinary({}, empty), null);
  assert.equal(resolveGraphBinary({ TTSC_GRAPH_BINARY: binary }, empty), binary);
  assert.equal(resolveGraphBinary({ TTSC_GRAPH_BINARY: "ttscgraph" }, empty), null);
  assert.equal(resolveGraphBinary({}), resolveGraphBinary({}, process.cwd()));
  const previous = process.env.TTSC_GRAPH_BINARY;
  delete process.env.TTSC_GRAPH_BINARY;
  try {
    const session = new TtscGraphSession({ cwd: root, tsconfig: "tsconfig.json" });
    try {
      assert.equal((session as unknown as { state: { hasPeer(): boolean } }).state.hasPeer(), false);
    } finally { session.close(); }
    assert.throws(() => new TtscGraphSession({ cwd: empty, tsconfig: "tsconfig.json" }), /could not resolve the ttscgraph binary/u);
  } finally {
    if (previous === undefined) delete process.env.TTSC_GRAPH_BINARY;
    else process.env.TTSC_GRAPH_BINARY = previous;
  }
}

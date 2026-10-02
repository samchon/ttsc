import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveGraphBinary } from "../../../../packages/graph/src/resolveGraphBinary";
import { TtscGraphSession } from "../../../../packages/graph/src/model/TtscGraphSession";

/**
 * Verifies binary lookup and session construction use their target cwd.
 *
 * The resolver interprets a package-shaped filesystem fixture: a temporary
 * node_modules tree holding ttsc and a platform package whose binary file is
 * inert text. The binary is never executed.
 *
 * 1. Resolve the binary for the fixture cwd and for an empty cwd.
 * 2. Check absolute override precedence, a relative override being ignored, and
 *    the default-cwd equivalence.
 * 3. Construct and close a session for the fixture cwd, and require
 *    the missing-binary error from a session for the empty cwd.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphBinary must return the fixture platform binary (compared by realpath) for the cwd holding node_modules/ttsc, null for a cwd with no ttsc, the absolute TTSC_GRAPH_BINARY value even for the empty cwd, and null for a relative override; new TtscGraphSession for the fixture cwd must construct and close, while one for the empty cwd must throw the could-not-resolve error.
 * @evidence contracts/testing.md#independent-expectations The expected path is the binary file the test itself created, and the null results and override values are literals. TTSC_GRAPH_BINARY is removed from the environment around the session cases so only cwd resolution is exercised. The assertion resolveGraphBinary({}) equals resolveGraphBinary({}, process.cwd()) compares the function with itself under its default and only pins the default-cwd rule.
 * @evidence contracts/testing.md#distinguishing-cases Installed versus uninstalled cwd, absolute versus relative override, and constructor success versus the missing-binary throw. A platform package without a ttsc peer, another platform name, and ensureExecutable failures are not covered.
 * @evidence contracts/testing.md#execution-ownership Runs resolveGraphBinary and the TtscGraphSession constructor in the test process over a temporary node_modules layout. The constructor applies ensureExecutable to the inert file, graph() is never called and no native process starts.
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
    await session.close();
    assert.throws(() => new TtscGraphSession({ cwd: empty, tsconfig: "tsconfig.json" }), /could not resolve the ttscgraph binary/u);
  } finally {
    if (previous === undefined) delete process.env.TTSC_GRAPH_BINARY;
    else process.env.TTSC_GRAPH_BINARY = previous;
  }
}

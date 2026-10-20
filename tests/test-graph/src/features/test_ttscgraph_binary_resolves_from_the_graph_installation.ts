import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { InstalledGraphBinary } from "../../../../packages/graph/src/internal/InstalledGraphBinary";
import { TtscGraphSession } from "../../../../packages/graph/src/model/TtscGraphSession";
import { resolveGraphBinary } from "../../../../packages/graph/src/resolveGraphBinary";

/**
 * Verifies the ttscgraph binary resolves from the installed `@ttsc/graph`
 * package, not from the project being graphed.
 *
 * The resolver interprets package-shaped filesystem fixtures: an installed
 * `@ttsc/graph` beside its `@ttsc/graph-<platform>-<arch>` package whose two
 * producer files, `ttscgraph` and `ttscgraph-7.1`, are inert text, the same
 * installation without that package, projects installing TypeScript 7.0.2 and
 * the 7.1 nightly, and a target project in the layout earlier releases resolved
 * from, its `ttsc` platform package holding a `ttscgraph`. No binary is
 * executed.
 *
 * 1. Resolve from the installed fixture and from the installation that lacks the
 *    platform package.
 * 2. Select each project line's producer, and the 7.0 producer for a project whose
 *    TypeScript cannot be resolved.
 * 3. Check absolute override precedence and a relative override being ignored.
 * 4. Require the public resolver to ignore the target project's old layout.
 * 5. Construct and close a session for a project with no `ttsc` at all.
 *
 * @evidence contracts/testing.md#behavioral-verification InstalledGraphBinary.resolve must return the fixture platform binary (compared by realpath) for an anchor inside the installed package and null for the installation without the platform package; a TypeScript 7.0.2 project and a project without TypeScript get ttscgraph, and a 7.1 nightly project ttscgraph-7.1, even when an absolute override is absent; an absolute TTSC_GRAPH_BINARY wins even there, and a relative one falls back to installation lookup. resolveGraphBinary must give the same answer for a cwd holding the old ttsc-platform layout and for an empty cwd, never the old-layout binary. TtscGraphSession must construct and close for a project without ttsc when an absolute override names the producer.
 * @evidence contracts/testing.md#independent-expectations Expected paths are the files the test itself created and the override values are literals; the old-layout path is the location earlier releases resolved, so returning it is the regression this test distinguishes.
 * @evidence contracts/testing.md#distinguishing-cases Installed versus missing platform package, 7.0 versus 7.1 versus unresolvable project TypeScript, absolute versus relative override (the override wins over a 7.1 project), and old-layout versus empty target cwd. The public resolver's own installation is not asserted to exist, because the workspace platform binary is only present after a native build; the installed-consumer E2E owns that positive path.
 * @evidence contracts/testing.md#execution-ownership Runs InstalledGraphBinary.resolve, resolveGraphBinary and the TtscGraphSession constructor in the test process over temporary node_modules layouts. The constructor applies ensureExecutable to the inert file, graph() is never called and no native process starts.
 */
export async function test_ttscgraph_binary_resolves_from_the_graph_installation(): Promise<void> {
  const platform = `${process.platform}-${process.arch}`;
  const executable =
    process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph";

  const installed = TestProject.tmpdir("ttscgraph-installed-");
  const anchor = writeGraphPackage(installed);
  const platformPackage = path.join(
    installed,
    "node_modules",
    "@ttsc",
    `graph-${platform}`,
  );
  const binary = writeInert(
    platformPackage,
    `@ttsc/graph-${platform}`,
    executable,
  );
  const binary71 = path.join(
    platformPackage,
    "bin",
    process.platform === "win32" ? "ttscgraph-7.1.exe" : "ttscgraph-7.1",
  );
  fs.writeFileSync(binary71, "inert module-resolution input; never executed");
  const missing = TestProject.tmpdir("ttscgraph-missing-platform-");
  const missingAnchor = writeGraphPackage(missing);
  const project70 = writeTypeScriptProject("7.0.2");
  const project71 = writeTypeScriptProject("7.1.0-dev.20261020.3");
  const noTypeScript = TestProject.tmpdir("ttscgraph-no-typescript-");

  for (const [project, expected] of [
    [project70, binary],
    [project71, binary71],
    [noTypeScript, binary],
  ] as const) {
    const resolved = InstalledGraphBinary.resolve({}, anchor, project);
    assert.ok(resolved !== null);
    assert.equal(fs.realpathSync(resolved), fs.realpathSync(expected));
  }
  assert.equal(
    InstalledGraphBinary.resolve({}, missingAnchor, project70),
    null,
  );
  assert.equal(
    InstalledGraphBinary.resolve(
      { TTSC_GRAPH_BINARY: binary },
      missingAnchor,
      project71,
    ),
    binary,
  );
  assert.equal(
    InstalledGraphBinary.resolve(
      { TTSC_GRAPH_BINARY: "ttscgraph" },
      missingAnchor,
      project70,
    ),
    null,
  );
  const relative = InstalledGraphBinary.resolve(
    { TTSC_GRAPH_BINARY: "ttscgraph" },
    anchor,
    project70,
  );
  assert.ok(relative !== null);
  assert.equal(fs.realpathSync(relative), fs.realpathSync(binary));

  const legacy = TestProject.tmpdir("ttscgraph-legacy-target-");
  const legacyBinary = writeInert(
    path.join(legacy, "node_modules", "@ttsc", platform),
    `@ttsc/${platform}`,
    executable,
  );
  writeInert(path.join(legacy, "node_modules", "ttsc"), "ttsc", null);
  const empty = TestProject.tmpdir("ttscgraph-empty-target-");
  const fromLegacy = resolveGraphBinary({}, legacy);
  assert.notEqual(
    fromLegacy === null ? null : fs.realpathSync(fromLegacy),
    fs.realpathSync(legacyBinary),
  );
  assert.equal(fromLegacy, resolveGraphBinary({}, empty));

  const previous = process.env.TTSC_GRAPH_BINARY;
  process.env.TTSC_GRAPH_BINARY = binary;
  try {
    const session = new TtscGraphSession({
      cwd: empty,
      tsconfig: "tsconfig.json",
    });
    await session.close();
  } finally {
    if (previous === undefined) delete process.env.TTSC_GRAPH_BINARY;
    else process.env.TTSC_GRAPH_BINARY = previous;
  }
}

/**
 * Write a project installing the given TypeScript version: its manifest and an
 * inert platform compiler, which is all line selection reads.
 */
function writeTypeScriptProject(version: string): string {
  const root = TestProject.tmpdir("ttscgraph-typescript-project-");
  const modules = path.join(root, "node_modules");
  writeInert(path.join(modules, "typescript"), "typescript", null);
  fs.writeFileSync(
    path.join(modules, "typescript", "package.json"),
    JSON.stringify({ name: "typescript", version }),
  );
  writeInert(
    path.join(
      modules,
      "@typescript",
      `typescript-${process.platform}-${process.arch}`,
    ),
    `@typescript/typescript-${process.platform}-${process.arch}`,
    null,
  );
  const lib = path.join(
    modules,
    "@typescript",
    `typescript-${process.platform}-${process.arch}`,
    "lib",
  );
  fs.mkdirSync(lib, { recursive: true });
  fs.writeFileSync(
    path.join(lib, process.platform === "win32" ? "tsc.exe" : "tsc"),
    "inert compiler; never executed",
  );
  return root;
}

/** Write an installed `@ttsc/graph` package and return a file inside it. */
function writeGraphPackage(root: string): string {
  const directory = path.join(root, "node_modules", "@ttsc", "graph");
  fs.mkdirSync(path.join(directory, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ name: "@ttsc/graph", version: "0.0.0" }),
  );
  const anchor = path.join(directory, "lib", "resolveGraphBinary.js");
  fs.writeFileSync(anchor, "inert module-resolution anchor; never loaded");
  return anchor;
}

/** Write a package manifest and, when named, an inert executable beside it. */
function writeInert(
  directory: string,
  name: string,
  executable: string | null,
): string {
  fs.mkdirSync(path.join(directory, "bin"), { recursive: true });
  fs.writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ name, version: "0.0.0" }),
  );
  if (executable === null) return directory;
  const file = path.join(directory, "bin", executable);
  fs.writeFileSync(file, "inert module-resolution input; never executed");
  return file;
}

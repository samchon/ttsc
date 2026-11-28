import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { TestProject } from "../../../../utils/src/TestProject";
import { assert, fs, path, workspaceRoot } from "../../internal/script-unit";

/**
 * Verifies that project scratch and its existing parent fall back to the
 * project's record store when no system temporary directory qualifies.
 *
 * A project marker above every system temp parent, such as a `package.json` in
 * the Windows account's home directory, failed every plugin build. Here the
 * operation's own roots cover each system parent, which disqualifies all of
 * them the same way on every platform.
 *
 * 1. Allocate and select a parent normally, and observe a system temp parent.
 * 2. Cover every system parent with the operation roots. The allocation opens the
 *    project's store and lands below `node_modules/.cache/ttsc/identities`, and
 *    the parent then reuses it.
 * 3. Observe that a projectless allocation and a project whose cache path is a
 *    file still refuse, without creating a store in that project.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production allocator and parent selector in a Node child with a controlled environment and asserts where each directory is created or selected, or that the call is refused.
 * @evidence contracts/testing.md#independent-expectations The default workspace cache layout `node_modules/.cache/ttsc` and its `identities` child define the expected fallback parent. The system parents come from the selector before the operation covers them.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary calls keep a system parent. With covered parents, the allocation opens an absent store and the parent selector reuses the existing one, while covered parents without a project, and a project whose cache path is a file, refuse both calls.
 * @evidence contracts/testing.md#execution-ownership A unit test that spawns one bounded Node child running repository source through the unit loader. The test owns both fixture projects and removes every allocation.
 */
export function test_createprojecttempdirectory_falls_back_to_the_project_record_store(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-project-scratch-"),
  );
  const project = path.join(root, "project");
  const blocked = path.join(root, "blocked");
  for (const directory of [project, blocked]) {
    fs.mkdirSync(path.join(directory, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(directory, "package.json"), "{}\n");
  }
  const blockedCache = path.join(blocked, "node_modules", ".cache", "ttsc");
  fs.mkdirSync(path.dirname(blockedCache));
  fs.writeFileSync(blockedCache, "not a directory\n");

  const source = (file: string): string =>
    JSON.stringify(path.join(workspaceRoot, "packages/ttsc/src", file));
  const script = `
    const { createProjectTempDirectory } = require(${source("internal/createProjectTempDirectory.ts")});
    const { systemTempOutsideProject } = require(${source("internal/systemTempOutsideProject.ts")});
    const [project, blocked] = JSON.parse(process.argv[1]);
    const attempt = (operation) => {
      try {
        return { directory: operation() };
      } catch (error) {
        return { error: String(error && error.message) };
      }
    };
    const parents = (owner) =>
      [...systemTempOutsideProject.candidates(owner)].map((entry) => entry.directory);
    const system = parents(project);
    process.stdout.write(JSON.stringify({
      system,
      ordinary: attempt(() => createProjectTempDirectory("ttsc-scratch-", project)),
      covered: attempt(() => createProjectTempDirectory("ttsc-scratch-", project, system)),
      projectless: attempt(() => createProjectTempDirectory("ttsc-scratch-", undefined, system)),
      refused: attempt(() => createProjectTempDirectory("ttsc-scratch-", blocked, parents(blocked))),
      ordinaryParent: attempt(() => createProjectTempDirectory.parent(project)),
      coveredParent: attempt(() => createProjectTempDirectory.parent(project, system)),
      refusedParent: attempt(() => createProjectTempDirectory.parent(blocked, parents(blocked))),
    }));
  `;
  const env = { ...process.env };
  delete env.TTSC_CACHE_DIR;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(path.join(workspaceRoot, "config/register-unit-loader.mjs"))
        .href,
      "-e",
      script,
      JSON.stringify([project, blocked]),
    ],
    { cwd: root, encoding: "utf8", env, timeout: 60_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout) as Record<
    | "ordinary"
    | "covered"
    | "projectless"
    | "refused"
    | "ordinaryParent"
    | "coveredParent"
    | "refusedParent",
    { directory?: string; error?: string }
  > & { system: string[] };
  try {
    assert.notEqual(observed.system.length, 0);
    assert.ok(
      observed.ordinary.directory !== undefined &&
        observed.system.includes(path.dirname(observed.ordinary.directory)),
      JSON.stringify(observed.ordinary),
    );
    const identities = path.join(
      project,
      "node_modules",
      ".cache",
      "ttsc",
      "identities",
    );
    assert.equal(
      observed.covered.directory === undefined
        ? observed.covered.error
        : path.dirname(observed.covered.directory),
      identities,
    );
    assert.ok(
      observed.ordinaryParent.directory !== undefined &&
        observed.system.includes(observed.ordinaryParent.directory),
      JSON.stringify(observed.ordinaryParent),
    );
    assert.equal(
      observed.coveredParent.directory ?? observed.coveredParent.error,
      identities,
    );
    assert.match(
      observed.projectless.error ?? "",
      /^ttsc: no existing system temporary directory$/,
    );
    for (const refused of [observed.refused, observed.refusedParent])
      assert.match(
        refused.error ?? "",
        /^ttsc: no existing system temporary directory outside /,
      );
    assert.equal(fs.readFileSync(blockedCache, "utf8"), "not a directory\n");
    assert.deepEqual(fs.readdirSync(path.dirname(blockedCache)), ["ttsc"]);
  } finally {
    for (const { directory } of [observed.ordinary, observed.covered])
      if (directory !== undefined) fs.rmSync(directory, { recursive: true });
  }
}

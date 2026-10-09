import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies a project reached through a link keeps its inputs and candidates
 * covered by its watchers, so a delivery after the first reads none of them
 * (samchon/ttsc#1459).
 *
 * The trackers refused coverage to every input whose path traversed a link
 * anywhere above it, and the project tracker withdrew its whole coverage when
 * the root itself lay below one. Every macOS temporary directory does, so on
 * the macOS lane every delivery re-read its candidates and inputs, twenty-seven
 * probes where none was budgeted. The watched directory's identity is checked
 * on every delivery already, which is what a link at or above it needs.
 *
 * 1. Link a project whose envelope names absent candidates, and deliver its first
 *    module through the link.
 * 2. Deliver the remaining modules through the link, and assert nothing below the
 *    project was read, listed, or probed.
 *
 * @evidence contracts/testing.md#behavioral-verification A linked four-module cache project with external graph inputs and absent candidates must compile once and deliver remaining modules without reading/listing/probing anything below either lexical or physical root. Instrumented filesystem operations expose repeated fallback work while root identity checks remain allowed.
 * @evidence contracts/testing.md#independent-expectations A stable linked root and unchanged proved inputs permit watcher reuse. Independent filesystem-operation recording and native log bytes assert zero below-root work after initial delivery without deriving expected operations from tracker internals; result presence verifies each module was delivered.
 * @evidence contracts/testing.md#distinguishing-cases Initial capture through a symlink/junction contrasts with unchanged linked sibling deliveries. Physical and lexical root spellings are both counted so alias-based probes cannot evade the oracle; root-only identity checks are explicitly permitted.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_a_linked_project_keeps_its_notification_coverage owns native capture and unchanged sibling deliveries through a linked root with filesystem-call recording. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary The real link/junction, native envelope and filesystem notification coverage meet the public cache. Synthetic path normalization alone cannot establish linked-root watchers remain authoritative across actual sibling deliveries.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject and shared counting-sidecar artifact serve all four modules through a single cache. The link is an alias of the existing fixture rather than another installation; initial capture and settled watcher setup are shared before counting sibling validation work.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique fixture root and unique link parent isolate aliases. Counters clear only after first capture and a two-turn watcher settle, preserving the initial cold path while measuring reuse. No explicit cache reset occurs here; watcher and temporary directory lifetime is bounded by the test runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_linked_project_keeps_its_notification_coverage; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_linked_project_keeps_its_notification_coverage(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 4,
    graphCandidates: 3,
    graphFanout: 4,
  });
  const physical = fs.realpathSync.native(project.root);
  const linked = path.join(TestProject.tmpdir("ttsc-link-"), "project");
  fs.symlinkSync(
    physical,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  const below = (location: string): boolean => {
    for (const root of [physical, linked]) {
      const relative = path.relative(root, path.resolve(location));
      if (
        relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative)
      )
        return true;
    }
    return false;
  };
  const touched: string[] = [];
  const count = (location: string): void => {
    if (below(location)) touched.push(path.resolve(location));
  };
  const cache = createTtscTransformCache({
    exists: (location: string) => {
      count(location);
      return fs.existsSync(location);
    },
    lstat: (location: string) => {
      count(location);
      return fs.lstatSync(location, { bigint: true });
    },
    readFile: (location: string) => {
      count(location);
      return fs.readFileSync(location);
    },
    readdir: (location: string) => {
      count(location);
      return fs.readdirSync(location, { withFileTypes: true });
    },
    stat: (location: string) => {
      count(location);
      return fs.statSync(location);
    },
    statBigInt: (location: string) => {
      count(location);
      return fs.statSync(location, { bigint: true });
    },
  });
  const modules = projectModules(project.root).map((file) =>
    path.join(linked, path.relative(project.root, file)),
  );
  const options = resolveOptions({
    project: path.join(linked, "tsconfig.json"),
  });
  const deliver = async (file: string): Promise<void> => {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
  };

  await deliver(modules[0]!);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
  // The delivery's own watchers settle before the next one reads them.
  await new Promise((resolve) => setImmediate(() => setImmediate(resolve)));

  touched.length = 0;
  for (const file of modules.slice(1)) await deliver(file);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
  // The project root itself is re-checked by identity on every delivery.
  const roots = new Set([physical, linked]);
  assert.deepEqual(
    [...new Set(touched)].filter((location) => !roots.has(location)),
    [],
    "the watchers answer for every input below the linked project",
  );
}

import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies an absent candidate reached through a link still invalidates when
 * the link is retargeted.
 *
 * The proof samchon/ttsc#1261 rests on is a watcher, and a watcher opened on a
 * spelling that traverses a link follows it to a physical directory:
 * retargeting the link moves the answer without touching what is watched. That
 * is the pnpm layout exactly, where `node_modules/<package>` is a link into a
 * store, so a reinstall makes a superseding candidate appear behind a watch
 * still looking at the old store directory. Watching each component of the
 * spelling by the name it carries in its own parent is what reports it.
 *
 * 1. Point a candidate's directory at an empty target through a link, so no
 *    realized input lives under it and only the candidate is at stake.
 * 2. Deliver one module to capture the generation.
 * 3. Retarget the link at a directory that does carry the candidate, and assert
 *    the next delivery recompiled.
 */
export async function test_transformttsc_retargeted_candidate_link_invalidates_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  // Fanout 1 keeps every realized edge target under `dep0`, while the second
  // candidate points at `dep1`, which the fixture never creates: the link below
  // is therefore the only thing standing between the candidate and its answer.
  const project = createCacheProject({
    fileCount: 3,
    graphCandidates: 2,
    graphFanout: 1,
  });
  const store = TestProject.tmpdir("ttsc-unplugin-candidate-store-");
  const before = path.join(store, "before");
  const after = path.join(store, "after");
  fs.mkdirSync(before, { recursive: true });
  fs.mkdirSync(after, { recursive: true });
  fs.writeFileSync(
    path.join(after, "index.ts"),
    "export const superseding = 1;\n",
    "utf8",
  );
  const link = path.join(project.root, "node_modules", "dep1");
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(before, link, "junction");

  const cache = createTtscTransformCache();
  const modules = projectModules(project.root);
  const options = resolveOptions();
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

  fs.rmSync(link, { force: true, recursive: true });
  fs.symlinkSync(after, link, "junction");
  await deliver(modules[1]!);

  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "retargeting the link a candidate is reached through must replace the generation",
  );
}

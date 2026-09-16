import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../packages/unplugin/lib/core/transform.js";
import { createViteServeInputWatch } from "../../../../packages/unplugin/lib/core/viteServe.js";
import { waitFor } from "./adapter-vite-serve";

/** Exercise subscription races, lexical aliases and predicates on the real watcher. */
export async function assertViteWatchBoundaries(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-vite-watch-boundary-"));
  const invalidated = new Set<string>();
  const watch = createViteServeInputWatch();
  watch.attach({ moduleGraph: {
    getModulesByFile: (file) => new Set([{ file }]),
    invalidateModule: (node) => invalidated.add((node as { file: string }).file),
  } });
  const importer = (name: string) => path.join(root, `${name}.ts`).replace(/\\/g, "/");
  const evidence = (file: string) => {
    const baseline = captureWatchInputBaseline(file);
    assert.ok(baseline);
    return { identity: baseline.identity, missing: !baseline.fileExists, state: { codec: "host" as const, hash: baseline.hostHash } };
  };
  try {
    const file = path.join(root, "input.txt");
    fs.writeFileSync(file, "before");
    const compiled = evidence(file);
    fs.unlinkSync(file);
    watch.replace(importer("race"), [{ file, evidence: compiled }]);
    await waitFor(() => invalidated.has(importer("race")), "deletion before initial subscription");

    for (const target of ["a", "b"]) {
      fs.mkdirSync(path.join(root, target));
      fs.writeFileSync(path.join(root, target, "value.txt"), target);
    }
    for (const alias of ["alias-a", "alias-b"]) {
      fs.symlinkSync(path.join(root, "a"), path.join(root, alias), "junction");
      const input = path.join(root, alias, "value.txt");
      watch.replace(importer(alias), [{ file: input, evidence: evidence(input) }]);
    }
    // Let the initial add events establish subscriptions before retargeting.
    // A synchronization input's invalidation proves the real event loop ran.
    fs.writeFileSync(file, "sync");
    watch.replace(importer("sync"), [{ file, evidence: compiled }]);
    await waitFor(() => invalidated.has(importer("sync")), "initial filesystem observations");
    fs.rmSync(path.join(root, "alias-b"));
    fs.symlinkSync(path.join(root, "b"), path.join(root, "alias-b"), "junction");
    await waitFor(() => invalidated.has(importer("alias-b")), "existing input through a retargeted junction");
    assert.ok(!invalidated.has(importer("alias-a")), "one alias must not invalidate an unchanged spelling");

    const candidate = path.join(root, "candidate.ts");
    const identity = evidence(candidate).identity;
    for (const [name, observation] of [
      ["exists", { directoryExists: false, fileExists: false }],
      ["file", { fileExists: false }],
    ] as const) {
      watch.replace(importer(name), [{ file: candidate, evidence: { identity, missing: true, state: { codec: "predicates", observation } } }]);
    }
    fs.mkdirSync(candidate);
    await waitFor(() => invalidated.has(importer("exists")), "directory availability predicate");
    assert.ok(!invalidated.has(importer("file")), "a directory does not satisfy a file predicate");
    watch.replace(importer("listing"), [{ file: candidate, evidence: { identity, missing: false, state: { codec: "predicates", observation: { directoryExists: true, accessibleEntries: { directories: [], files: [] } } } } }]);
    fs.writeFileSync(path.join(candidate, "member.txt"), "member");
    await waitFor(() => invalidated.has(importer("listing")), "exact directory membership predicate");
    fs.unlinkSync(path.join(candidate, "member.txt"));
    fs.rmdirSync(candidate);
    fs.writeFileSync(candidate, "file");
    await waitFor(() => invalidated.has(importer("file")), "file predicate retained after a different predicate changed");
  } finally { await watch.dispose(); }
}

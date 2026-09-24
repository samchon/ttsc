import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/lib/core/transform/clock/refreshFilesystemClockReference.mjs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/lib/core/transform/filesystem/TtscTransformFilesystemOperations.mjs";
import type { IClockRollbackFixture } from "./IClockRollbackFixture";

/**
 * Create a project and a plugin source observed through a filesystem whose
 * clock can step back, for proofs that trust a plugin source's file metadata
 * only against a clock reference minted since any rollback.
 *
 * A clock rollback is what lets a write land in the tick of a recorded stamp
 * and keep its metadata. Neither half can be produced on the host: its clock
 * does not step back on request, and a write moves the change time. The adapter
 * reads both through the filesystem operations it is handed, the seam an
 * embedder observing another filesystem supplies, so the fixture supplies one:
 * it holds the metadata of the source's files while their bytes change, and
 * reports the stamp of every file written outside the fixture, which is the
 * adapter's own clock probe, with the clock's step applied.
 */
export function createClockRollbackFixture(): IClockRollbackFixture {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-clock-rollback-"),
  );
  TestProject.writeFiles(root, {
    "project/tsconfig.json": "{}\n",
    "project/src/index.ts": "export const value = 1;\n",
    "plugin/go.mod": "module example.com/plugin\n\ngo 1.26\n",
    "plugin/internal/rules/rule.go": "package rules\n",
    "plugin/main.go": "package main\n\nfunc main() {}\n",
  });
  const project = path.join(root, "project");
  const source = path.join(root, "plugin");
  const files = () =>
    fs
      .readdirSync(source, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name));

  const held = new Map<string, fs.BigIntStats>();
  let step = 0n;
  const outside = (location: string) => {
    const relative = path.relative(root, location);
    return (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    );
  };
  const filesystem: TtscTransformFilesystemOperations = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    lstat: (location) => {
      const resolved = path.resolve(location);
      const kept = held.get(resolved);
      if (kept !== undefined) return kept;
      const stats = DEFAULT_FILESYSTEM_OPERATIONS.lstat(location);
      if (step === 0n || !stats.isFile() || !outside(resolved)) return stats;
      const stepped = Object.create(
        Object.getPrototypeOf(stats) as object,
      ) as fs.BigIntStats;
      return Object.assign(stepped, stats, { mtimeNs: stats.mtimeNs + step });
    },
  };
  return {
    root,
    project,
    source,
    filesystem,
    settle: () => {
      const past = new Date(Date.now() - 3_600_000);
      for (const file of files()) fs.utimesSync(file, past, past);
    },
    mintEarlier: () =>
      refreshFilesystemClockReference(
        fs.realpathSync.native(
          TestProject.tmpdir("ttsc-unplugin-clock-rollback-earlier-"),
        ),
        filesystem,
      ),
    hold: () => {
      held.clear();
      for (const file of files())
        held.set(path.resolve(file), DEFAULT_FILESYSTEM_OPERATIONS.lstat(file));
    },
    edit: () => fs.appendFileSync(path.join(source, "main.go"), "// edit\n"),
    stepBack: () => {
      step = -7_200_000_000_000n;
    },
  };
}

import fs from "node:fs";
import path from "node:path";

import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/refreshFilesystemClockReference";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/src/core/transform/filesystem/TtscTransformFilesystemOperations";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Create the shared direct-proof corpus with controlled source metadata and an
 * authored two-hour rollback applied only to outside native probe files. Actual
 * source bytes and Go environment inputs remain native observations; this
 * filesystem view does not claim that the execution host rolled back.
 */
export function createClockRollbackUnitFixture() {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-clock-unit-"),
  );
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/unplugin/test/fixtures/e2e/createClockRollbackFixture/inputs-1",
    ),
    root,
  );
  const project = path.join(root, "project");
  const source = path.join(root, "plugin");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/unplugin/test/fixtures/plugin-source-baseline",
    ),
    source,
  );
  const files = () =>
    fs
      .readdirSync(source, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name));
  const held = new Map<string, fs.BigIntStats>();
  let step = 0n;
  const outside = (location: string): boolean => {
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
          TestProject.tmpdir("ttsc-unplugin-clock-unit-earlier-"),
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

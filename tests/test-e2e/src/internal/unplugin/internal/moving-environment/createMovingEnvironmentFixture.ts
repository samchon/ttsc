import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import {
  pluginSourceState,
  processPluginBuildEnvironment,
} from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTransformFilesystemOperations } from "../../../../../../../packages/unplugin/lib/core/transform/filesystem/TtscTransformFilesystemOperations.mjs";
import { FixtureFiles } from "../../../FixtureFiles";
import type { IMovingEnvironmentFixture } from "./IMovingEnvironmentFixture";

/**
 * Create a plugin source whose Go build environment moves while a proof of it
 * is running, for the ordering a recorded tree environment depends on
 * (samchon/ttsc#1565).
 *
 * The adapter records, beside each plugin source tree it proved, the
 * environment reading the proof started from, read before the proof
 * (samchon/ttsc#1522). A move that lands during the proof is otherwise recorded
 * as proven. The proof reads the tree's file metadata through the filesystem
 * operations of the generation's result, the seam inside its window, and the
 * environment reading holds only while the metadata of the Go environment file
 * holds (samchon/ttsc#1516). So the fixture points `GOENV` at a file of its own
 * and moves the environment from the proof's first metadata read below the
 * tree, by writing a `GOFLAGS` line there. The tree's recorded state is the one
 * under the moved environment, so the proof holds and records a reading.
 */
export function createMovingEnvironmentFixture(): IMovingEnvironmentFixture {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-moving-environment-"),
  );
  TestProject.writeFiles(
    root,
    FixtureFiles.read("createMovingEnvironmentFixture/inputs-1", "unplugin"),
  );
  const project = path.join(root, "project");
  const source = path.join(root, "plugin");
  const environmentFile = path.join(root, "go.env");
  const saved = process.env.GOENV;
  process.env.GOENV = environmentFile;
  try {
    fs.writeFileSync(environmentFile, MOVED_ENVIRONMENT);
    const moved = processPluginBuildEnvironment(source, true);
    const movedState = pluginSourceState(source);
    fs.writeFileSync(environmentFile, "");
    const before = processPluginBuildEnvironment(source, true);

    let reads = 0;
    let landed = false;
    const below = (location: string): boolean => {
      const relative = path.relative(source, location);
      return (
        relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative)
      );
    };
    const observe = (location: string): void => {
      if (!below(location)) return;
      reads += 1;
      if (landed) return;
      landed = true;
      fs.writeFileSync(environmentFile, MOVED_ENVIRONMENT);
    };
    const filesystem: TtscTransformFilesystemOperations = {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      lstat: (location: string) => {
        observe(location);
        return DEFAULT_FILESYSTEM_OPERATIONS.lstat(location);
      },
      statBigInt: (location: string) => {
        observe(location);
        return DEFAULT_FILESYSTEM_OPERATIONS.statBigInt(location);
      },
    };
    return {
      before,
      dispose: () => {
        if (saved === undefined) delete process.env.GOENV;
        else process.env.GOENV = saved;
      },
      filesystem,
      moved,
      movedState,
      project,
      reads: () => reads,
      resetReads: () => {
        reads = 0;
      },
      source,
    };
  } catch (error) {
    if (saved === undefined) delete process.env.GOENV;
    else process.env.GOENV = saved;
    throw error;
  }
}

/** A `go env -w` line that changes the Go build environment. */
const MOVED_ENVIRONMENT = "GOFLAGS=-mod=mod\n";

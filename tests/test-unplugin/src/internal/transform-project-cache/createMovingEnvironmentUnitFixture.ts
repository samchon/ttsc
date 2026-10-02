import { TestProject } from "../../../../utils/src/TestProject";
import fs from "node:fs";
import path from "node:path";
import {
  pluginSourceState,
  processPluginBuildEnvironment,
} from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/src/core/transform/filesystem/TtscTransformFilesystemOperations";

/**
 * Copy the original source/project corpus and move its private GOENV at the
 * first supplied source metadata read. The actual provider supplies before
 * and moved labels plus source state, not synthetic environment digests.
 * GOFLAGS is temporarily absent so ambient overrides cannot hide the file's
 * literal GOFLAGS=-mod=mod line. Catch and dispose restore both exact prior
 * environment values; metadata-read counts remain case-local.
 */
export function createMovingEnvironmentUnitFixture() {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-moving-environment-"),
  );
  TestProject.copyDirectory(path.join(TestProject.WORKSPACE_ROOT, "packages/unplugin/test/fixtures/e2e/createMovingEnvironmentFixture/inputs-1"), root);
  const project = path.join(root, "project");
  const source = path.join(root, "plugin");
  const environmentFile = path.join(root, "go.env");
  const saved = process.env.GOENV;
  const savedFlags = process.env.GOFLAGS;
  process.env.GOENV = environmentFile;
  delete process.env.GOFLAGS;
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
        if (savedFlags === undefined) delete process.env.GOFLAGS;
        else process.env.GOFLAGS = savedFlags;
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
    if (savedFlags === undefined) delete process.env.GOFLAGS;
    else process.env.GOFLAGS = savedFlags;
    throw error;
  }
}

/** A `go env -w` line that changes the Go build environment. */
const MOVED_ENVIRONMENT = "GOFLAGS=-mod=mod\n";

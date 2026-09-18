import { TestUnpluginRuntime } from "@ttsc/testing";
import fs from "node:fs";

import { createCacheProject } from "../transform-project-cache/createCacheProject";
import { projectModules } from "../transform-project-cache/projectModules";

interface IMembershipSession {
  close: () => void;
  compiles: () => number;
  /** Deliver every module with no pass boundary, as a persistent host does. */
  deliver: () => Promise<void>;
  modules: string[];
  pass: () => Promise<void>;
  reads: () => number;
  root: string;
}

/**
 * A delivery session whose project options decide what can enter the program.
 *
 * Counts adapter file reads as well as compiles, because the walk's two costs
 * are separate: an entry that cannot be a program input must not move the
 * membership digest, and a file no comparison consults must not be read
 * (samchon/ttsc#1307).
 */
export async function startMembershipSession(
  options: Parameters<typeof createCacheProject>[0] = {},
  compilerOptions: Record<string, unknown> = {},
): Promise<IMembershipSession> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 3,
    graphFanout: 1,
    ...options,
  });
  let reads = 0;
  const cache = api.createTtscTransformCache({
    readFile: (location: string) => {
      reads += 1;
      return fs.readFileSync(location);
    },
  });
  const resolved = api.resolveOptions({ compilerOptions });
  const modules = projectModules(project.root);
  const deliverAll = async (): Promise<void> => {
    for (const file of modules) {
      await api.transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        resolved,
        undefined,
        cache,
        { addWatchFile: () => undefined },
      );
    }
  };
  return {
    close: () => api.resetTtscTransformCache(cache),
    compiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
    deliver: deliverAll,
    modules,
    pass: async () => {
      api.beginTtscTransformBuild(cache);
      for (const file of modules) {
        await api.transformTtsc(
          file,
          fs.readFileSync(file, "utf8"),
          resolved,
          undefined,
          cache,
          { addWatchFile: () => undefined },
        );
      }
    },
    reads: () => reads,
    root: project.root,
  };
}

import { TestUnpluginRuntime } from "@ttsc/testing";
import fs from "node:fs";

import { createCacheProject } from "../transform-project-cache/createCacheProject";
import { projectModules } from "../transform-project-cache/projectModules";
import type { IDeliveryPassSession } from "./IDeliveryPassSession";

/** Start a session over a fresh graph-bearing fixture project. */
export async function startDeliveryPassSession(
  fileCount = 4,
): Promise<IDeliveryPassSession> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount, graphFanout: 1 });
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  return {
    close: () => api.resetTtscTransformCache(cache),
    compiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
    deliver: (file: string) =>
      api.transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        options,
        undefined,
        cache,
        { addWatchFile: () => undefined },
      ),
    modules: projectModules(project.root),
    pass: () => api.beginTtscTransformBuild(cache),
    root: project.root,
  };
}

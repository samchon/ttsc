import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { ICacheProjectOptions } from "./ICacheProjectOptions";
import { createCacheProject } from "./createCacheProject";
import { projectModules } from "./projectModules";

interface ICapturedWatchInput {
  evidence?: {
    identity: string;
    missing: boolean;
    unavailable?: "missing" | "not-file";
  };
  input: string;
}

/**
 * Drive a real transform over every module of a multi-file project sharing one
 * persistent cache, then return how many whole-project transforms the fixture
 * plugin actually ran plus the per-module results.
 *
 * The fixture plugin appends one byte to a run-log file on every invocation, so
 * the caller can assert that the cache collapsed N modules into a single
 * compile.
 */
export async function runProjectBuild(options: ICacheProjectOptions): Promise<{
  pluginRuns: number;
  outputs: string[];
  root: string;
  watchInputs: ICapturedWatchInput[];
}> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject(options);
  const candidate = path.join(project.root, "node_modules", "dep0", "index.ts");
  const recordsCandidate = (location: string): boolean =>
    path.resolve(location) === candidate;
  const cache =
    options.candidateFilesystemIo === undefined
      ? createTtscTransformCache()
      : createTtscTransformCache({
          readFile: (location: string) => {
            if (recordsCandidate(location)) {
              options.candidateFilesystemIo!.readFile += 1;
            }
            return fs.readFileSync(location);
          },
          realpath: (location: string) => {
            if (recordsCandidate(location)) {
              options.candidateFilesystemIo!.realpath += 1;
            }
            return fs.realpathSync.native(location);
          },
          stat: (location: string) => {
            if (recordsCandidate(location)) {
              options.candidateFilesystemIo!.stat += 1;
            }
            return fs.statSync(location);
          },
        });
  const outputs: string[] = [];
  const watchInputs: ICapturedWatchInput[] = [];
  for (const file of projectModules(project.root)) {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      resolveOptions(),
      undefined,
      cache,
      options.captureWatchEvidence === true
        ? {
            addWatchFile: (
              input: string,
              evidence?: ICapturedWatchInput["evidence"],
            ) => watchInputs.push({ evidence, input }),
          }
        : undefined,
    );
    assert.ok(result, `expected transformed output for ${file}`);
    outputs.push(result.code);
  }
  const pluginRuns = fs.existsSync(project.runLog)
    ? fs.readFileSync(project.runLog, "utf8").length
    : 0;
  return { pluginRuns, outputs, root: project.root, watchInputs };
}

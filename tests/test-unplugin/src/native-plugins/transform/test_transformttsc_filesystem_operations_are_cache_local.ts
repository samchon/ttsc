import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/** Assert concurrent caches neither share counters nor propagate one fault. */
export async function test_transformttsc_filesystem_operations_are_cache_local(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const firstProject = createCacheProject({ fileCount: 1 });
  const secondProject = createCacheProject({ fileCount: 1 });
  const firstFile = projectModules(firstProject.root)[0]!;
  const secondFile = projectModules(secondProject.root)[0]!;
  const options = resolveOptions();
  const reads = { first: 0, second: 0 };
  const firstOperationLocations: string[] = [];
  let firstFaults = 0;
  const isWithin = (root: string, location: string): boolean => {
    const relative = path.relative(root, location);
    return (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    );
  };
  const first = createTtscTransformCache({
    readFile: (location: string) => {
      reads.first += 1;
      return fs.readFileSync(location);
    },
    readdir: (location: string) => {
      if (fs.existsSync(firstProject.runLog)) {
        const absolute = path.resolve(location);
        firstOperationLocations.push(absolute);
        if (isWithin(firstProject.root, absolute)) {
          firstFaults += 1;
          const error = new Error(
            "first cache injected readdir failure",
          ) as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const second = createTtscTransformCache({
    readFile: (location: string) => {
      reads.second += 1;
      return fs.readFileSync(location);
    },
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
  });

  const [firstResult, secondResult] = await Promise.allSettled([
    transformTtsc(
      firstFile,
      fs.readFileSync(firstFile, "utf8"),
      options,
      undefined,
      first,
    ),
    transformTtsc(
      secondFile,
      fs.readFileSync(secondFile, "utf8"),
      options,
      undefined,
      second,
    ),
  ]);
  assert.equal(firstResult.status, "rejected");
  assert.match(
    (firstResult as PromiseRejectedResult).reason.message,
    /after 2 attempts/,
  );
  assert.match(
    (firstResult as PromiseRejectedResult).reason.message,
    /project\/directory-read-failed/,
  );
  assert.equal(secondResult.status, "fulfilled");
  assert.ok((secondResult as PromiseFulfilledResult<unknown>).value);
  assert.ok(reads.first > 0);
  assert.ok(reads.second > 0);
  assert.ok(firstFaults > 0);
  assert.ok(
    firstOperationLocations.every(
      (location) => !isWithin(secondProject.root, location),
    ),
    "the first cache's injected failure must never observe the second project",
  );
}

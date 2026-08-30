import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createRealNativeEnvelopeFixture } from "./real-native-envelope";
import { createCacheProject, projectModules } from "./transform-project-cache";

/** The identity of the generation currently cached under the single key. */
function cachedGeneration(cache: Map<string, Promise<unknown>>): unknown {
  assert.equal(cache.size, 1, "one project must own one cache entry");
  return [...cache.values()][0];
}

/**
 * A real native-host project whose program carries one type error.
 *
 * The linked contributor shares the compiler's own program, so the transform
 * really does see the program's diagnostics. A sidecar fixture cannot stand in
 * here: its transform lane never type-checks, so a planted type error would
 * produce an ordinary `"success"` and the scenario would assert nothing.
 *
 * Measured, and worth stating because it is not the obvious half of the
 * envelope contract: an ordinary type error arrives as `type: "exception"`
 * carrying the compiler's own diagnostic text, not as the `"failure"` variant
 * whose documentation describes exactly this case. That is why the adapter
 * cannot classify the two apart and bounds the repetition by the pass instead.
 */
async function startFailingCompile(broken = true): Promise<{
  api: any;
  brokenFile: string;
  cache: Map<string, Promise<unknown>>;
  deliver: (file: string) => Promise<unknown>;
  modules: string[];
}> {
  const fixture = createRealNativeEnvelopeFixture();
  const brokenFile = path.join(fixture.root, "src", "broken.ts");
  if (broken) {
    fs.writeFileSync(
      brokenFile,
      "export const broken: number = 'text';\n",
      "utf8",
    );
  }
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  return {
    api,
    brokenFile,
    cache,
    deliver: (file: string) =>
      api.transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        options,
        undefined,
        cache,
      ),
    modules: fixture.modules,
  };
}

/**
 * Asserts samchon/ttsc#1303: a failed compile costs one compile per pass, not
 * one per delivered module.
 *
 * A pass settles every delivery against the state it started from, so an
 * attempt the pass already made is part of that state. Evicting it instead made
 * each remaining module repeat the whole-project transform only to reach the
 * identical answer, which on a real project turns one broken save into a build
 * measured in hours.
 *
 * Generation identity is the observation rather than a compile counter on
 * purpose: a compile that fails never reaches the fixture's `ApplyProgram`, so
 * its run log cannot count it. The cached promise staying the same object is
 * the direct evidence that no second compilation was started.
 *
 * This also pins the limit of the retention. A host that opens exactly one pass
 * for its whole process, which Bun's runtime plugin and a dev server with
 * `server.watch: null` both do, never reaches the boundary that drops a
 * verdict, so what this scenario measures across four deliveries is what such a
 * session gets for its lifetime. That is deliberate: both hosts publish their
 * session as immutable, and the alternative is the whole-project compile per
 * module that this replaces.
 */
export async function assertAFailedCompileCostsOneCompilePerPass(): Promise<void> {
  const { api, cache, deliver, modules } = await startFailingCompile();
  api.beginTtscTransformBuild(cache);
  try {
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    const verdict = cachedGeneration(cache);

    for (const file of modules.slice(1)) {
      await assert.rejects(() => deliver(file), /is not assignable/);
      assert.equal(
        cachedGeneration(cache),
        verdict,
        `delivering ${path.basename(file)} must replay the pass verdict rather than start a second compile`,
      );
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts the next pass drops the verdict and attempts the compile again.
 *
 * A pass verdict is bounded by the pass that produced it, and deliberately not
 * proven against a recorded environment: the envelope cannot say whether the
 * host reported diagnostics about the project or failed to run at all, since an
 * ordinary type error arrives as an `"exception"` carrying the compiler's own
 * diagnostic text exactly as a crashed host would. A new pass is the first
 * boundary at which the host itself claims something may have changed, so the
 * attempt is repeated there — which is what keeps a genuinely transient failure
 * from becoming permanent, at a bounded cost of one compile per pass.
 */
export async function assertANewPassRetriesAFailedCompile(): Promise<void> {
  const { api, cache, deliver, modules } = await startFailingCompile();
  try {
    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    const first = cachedGeneration(cache);

    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    const second = cachedGeneration(cache);
    assert.notEqual(
      second,
      first,
      "a new pass must attempt the compile again rather than replay the previous pass's verdict",
    );

    for (const file of modules.slice(1)) {
      await assert.rejects(() => deliver(file), /is not assignable/);
      assert.equal(
        cachedGeneration(cache),
        second,
        "the rest of the second pass must replay that pass's own verdict",
      );
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts a corrected project compiles again on the next pass.
 *
 * The property the per-delivery eviction was protecting: retention must never
 * become a dead end. Recovery arrives at the pass boundary rather than through
 * a special case, and the corrected delivery has to produce real output rather
 * than merely a different verdict.
 */
export async function assertAFixedCompileSucceedsOnTheNextPass(): Promise<void> {
  const { api, brokenFile, cache, deliver, modules } =
    await startFailingCompile();
  try {
    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);

    fs.writeFileSync(brokenFile, "export const broken: number = 1;\n", "utf8");
    api.beginTtscTransformBuild(cache);
    const recovered = await deliver(modules[0]!);
    assert.ok(recovered, "the corrected project must transform");
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts a host with no pass boundary keeps evicting a failed compile.
 *
 * The retention is scoped to a pass precisely because a long-lived worker has
 * none: Metro and the Turbopack loader must retry on their very next delivery
 * so a transient toolchain failure never becomes permanent for the life of the
 * process. This is the negative twin of the retention above, and the property
 * samchon/ttsc#672 established.
 */
export async function assertAFailedCompileWithoutAPassIsStillEvicted(): Promise<void> {
  const { api, cache, deliver, modules } = await startFailingCompile();
  try {
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    assert.equal(
      cache.size,
      0,
      "without a delivery pass a failed compile must not stay cached",
    );
    await assert.rejects(() => deliver(modules[1]!), /is not assignable/);
    assert.equal(cache.size, 0);
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts a module the compile has no output for does not fail the whole pass.
 *
 * `selectTransformedSource` throws from three places, and only two of them say
 * anything about the generation. The third says one file has no output, which
 * is an ordinary condition for a module the bundle reaches but the tsconfig
 * program does not contain: `@ttsc/metro` treats it as "pass this file
 * through", and a bundler reaching one is a configuration, not a fault.
 *
 * Retaining that as a pass verdict would reject every later module of the pass
 * with an error naming a file none of them asked about. Evicting the generation
 * instead, which is what happened before any of this, makes every later module
 * recompile the whole project to reach the same answer, which is the cost
 * samchon/ttsc#1303 is about. Neither is right: the generation compiled fine
 * and simply has nothing for this one file, so it is left exactly where it is.
 * This is the boundary of what a pass verdict may cover.
 */
export async function assertAnOutOfProgramModuleDoesNotFailThePass(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 3, graphFanout: 1 });
  const modules = projectModules(project.root);
  // Under the project root but outside the tsconfig's `include: ["src"]`, so
  // the program has no entry for it. Planted before the first delivery, since
  // creating it later would be a membership change instead.
  const outside = path.join(project.root, "outside", "helper.ts");
  fs.mkdirSync(path.dirname(outside), { recursive: true });
  fs.writeFileSync(outside, "export const helper = 1;\n", "utf8");

  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  api.beginTtscTransformBuild(cache);
  try {
    assert.ok(await deliver(modules[0]!));
    const generation = cachedGeneration(cache);

    assert.equal(
      await deliver(outside),
      undefined,
      "a module the program does not contain is left to the host, not failed",
    );
    assert.equal(
      cachedGeneration(cache),
      generation,
      "a generation that compiled fine must survive a module it has no output for",
    );

    for (const file of modules.slice(1)) {
      assert.ok(
        await deliver(file),
        `${path.basename(file)} must still be served after an out-of-program module`,
      );
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts a host with no delivery pass surfaces a generation's diagnostics once
 * per generation.
 *
 * The guard is two fields rather than one because a persistent host's epoch is
 * `undefined`, which is also the initial value: collapsing them into a single
 * epoch comparison would silently suppress the very first report for Metro, the
 * Turbopack loader and a watching dev server. The rule is the same one the pass
 * uses, with one pass.
 */
export async function assertPersistentDiagnosticsAreReportedOncePerGeneration(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 1 });
  const modules = projectModules(project.root);
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const marker = "TTSC-TEST-PERSISTENT-WARNING";
  const original = process.stderr.write.bind(process.stderr);
  let writes = 0;
  try {
    // No `beginTtscTransformBuild` anywhere: this is the persistent lifecycle.
    assert.ok(await deliver(modules[0]!));
    const key = [...cache.keys()][0]!;
    const good = (await cache.get(key)) as Record<string, unknown>;
    cache.set(
      key,
      Promise.resolve({
        ...good,
        diagnosticsEpoch: undefined,
        diagnosticsReported: false,
        result: {
          ...(good.result as Record<string, unknown>),
          diagnostics: [
            {
              category: "warning",
              character: 1,
              file: "src/mod0.ts",
              line: 1,
              messageText: marker,
            },
          ],
        },
        servedFiles: new Set<string>(),
      }),
    );

    (process.stderr as { write: unknown }).write = (
      chunk: unknown,
      ...rest: unknown[]
    ) => {
      if (String(chunk).includes(marker)) writes += 1;
      return (original as (...args: unknown[]) => boolean)(chunk, ...rest);
    };

    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      1,
      `a persistent host must surface one generation's diagnostics once; wrote ${writes} times for ${modules.length} deliveries`,
    );
  } finally {
    (process.stderr as { write: unknown }).write = original;
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts samchon/ttsc#1304: a generation's non-error diagnostics are surfaced
 * once per pass, not once per delivered module.
 *
 * The diagnostics describe one compile of one program, so writing them per
 * delivery printed the same warning once per module and scaled the noise with
 * exactly the reuse the cache exists to provide. The envelope is re-published
 * with a `warning`-category diagnostic attached — the shape
 * `toCompilerTransformation` produces for a compile whose diagnostics carry no
 * `"error"` category, which is what `@ttsc/lint` emits for every rule below
 * error severity — because no fixture plugin produces one on its own.
 */
export async function assertGenerationDiagnosticsAreReportedOncePerPass(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 1 });
  const modules = projectModules(project.root);
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const marker = "TTSC-TEST-PROJECT-WIDE-WARNING";
  const original = process.stderr.write.bind(process.stderr);
  let writes = 0;
  try {
    api.beginTtscTransformBuild(cache);
    assert.ok(await deliver(modules[0]!));
    const key = [...cache.keys()][0]!;
    const good = (await cache.get(key)) as Record<string, unknown>;
    cache.set(
      key,
      Promise.resolve({
        ...good,
        diagnosticsEpoch: undefined,
        diagnosticsReported: false,
        result: {
          ...(good.result as Record<string, unknown>),
          diagnostics: [
            {
              category: "warning",
              character: 1,
              file: "src/mod0.ts",
              line: 1,
              messageText: marker,
            },
          ],
        },
        servedFiles: new Set<string>(),
      }),
    );

    (process.stderr as { write: unknown }).write = (
      chunk: unknown,
      ...rest: unknown[]
    ) => {
      if (String(chunk).includes(marker)) writes += 1;
      return (original as (...args: unknown[]) => boolean)(chunk, ...rest);
    };

    api.beginTtscTransformBuild(cache);
    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      1,
      `every module of one pass shares one generation, so its diagnostics belong to the pass; wrote ${writes} times for ${modules.length} modules`,
    );

    api.beginTtscTransformBuild(cache);
    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      2,
      "a later pass must surface the standing warning again, once",
    );
  } finally {
    (process.stderr as { write: unknown }).write = original;
    api.resetTtscTransformCache(cache);
  }
}

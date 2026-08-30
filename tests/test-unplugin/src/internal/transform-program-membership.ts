import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject, projectModules } from "./transform-project-cache";

interface IMembershipSession {
  close: () => void;
  compiles: () => number;
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
async function startMembershipSession(
  options: Parameters<typeof createCacheProject>[0] = {},
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
  const resolved = api.resolveOptions();
  const modules = projectModules(project.root);
  return {
    close: () => api.resetTtscTransformCache(cache),
    compiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
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

/** Write one content-hashed bundle, replacing the previous build's. */
function emitHashedBundle(
  root: string,
  directory: string,
  build: number,
): void {
  const target = path.join(root, directory);
  fs.mkdirSync(target, { recursive: true });
  for (const stale of fs.readdirSync(target)) {
    fs.rmSync(path.join(target, stale), { force: true, recursive: true });
  }
  fs.writeFileSync(
    path.join(target, `bundle.${build}${build}${build}abcd.js`),
    `// build ${build}\n`,
    "utf8",
  );
}

/**
 * Asserts content-hashed bundle output costs no compile, in a directory no
 * configuration names.
 *
 * The sharpest form of samchon/ttsc#1307. Rewriting one output file in place is
 * already free, because content is compared over the generation's declared
 * inputs alone. Content-hashed filenames are not: every rebuild removes a name
 * and adds another, which is a directory membership change, and the digest used
 * to record every entry regardless of whether it could ever enter the program.
 * That made a bundler's own output invalidate the generation that produced it,
 * once per rebuild, for the whole life of the session.
 *
 * `lib` is deliberately not the project's `outDir` and not one of the three
 * names the walk still refuses, so nothing but the input-extension rule can
 * make this pass: the project admits no JavaScript, so a `.js` bundle is not a
 * membership change wherever it lands.
 */
export async function assertHashedBundleOutputKeepsTheGeneration(): Promise<void> {
  const session = await startMembershipSession();
  try {
    for (let build = 1; build <= 4; build += 1) {
      emitHashedBundle(session.root, "lib", build);
      await session.pass();
    }
    assert.equal(
      session.compiles(),
      1,
      "content-hashed output must not cost a compile per rebuild",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a new source file is detected wherever it lands, including a
 * directory whose bare name the old ignore list happened to carry.
 *
 * The other half of samchon/ttsc#1307, and the half that was a correctness
 * defect rather than a cost. The ignore list matched a bare entry name at every
 * depth, so `src/build/` was dropped from the walk entirely and a program input
 * created there was never seen: the adapter kept serving output from a compile
 * that had never read the file. The control and the subject are the same file
 * under two directory names, and before the fix they answered differently.
 */
export async function assertANewSourceIsDetectedInAnyDirectory(): Promise<void> {
  const session = await startMembershipSession();
  try {
    await session.pass();
    assert.equal(session.compiles(), 1);
    await session.pass();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    const control = path.join(session.root, "src", "feature", "a.ts");
    fs.mkdirSync(path.dirname(control), { recursive: true });
    fs.writeFileSync(control, "export const a: number = 1;\n", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a new source in an ordinary directory must replace the generation",
    );

    // The same file, under a name the old list refused to walk.
    const subject = path.join(session.root, "src", "build", "b.ts");
    fs.mkdirSync(path.dirname(subject), { recursive: true });
    fs.writeFileSync(subject, "export const b: number = 2;\n", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "a new source must be detected even where the old ignore list matched",
    );

    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "and the generation settles again once nothing moves",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts `allowJs` decides whether emitted JavaScript is a membership change.
 *
 * The rule the fix replaced a name list with. A project that admits no
 * JavaScript cannot gain a program input when a `.js` file appears, so the
 * appearance is not membership. A project that admits JavaScript can, so it is,
 * and refusing to invalidate there would be the correctness half of the same
 * defect in the other direction.
 */
export async function assertAllowJsDecidesJavaScriptMembership(): Promise<void> {
  const strict = await startMembershipSession();
  try {
    await strict.pass();
    assert.equal(strict.compiles(), 1);
    fs.writeFileSync(
      path.join(strict.root, "src", "emitted.js"),
      "module.exports = 1;\n",
      "utf8",
    );
    await strict.pass();
    assert.equal(
      strict.compiles(),
      1,
      "a project that admits no JavaScript must not treat a .js file as membership",
    );
  } finally {
    strict.close();
  }

  const widened = await startMembershipSession({ allowJs: true });
  try {
    await widened.pass();
    assert.equal(widened.compiles(), 1);
    fs.writeFileSync(
      path.join(widened.root, "src", "emitted.js"),
      "module.exports = 1;\n",
      "utf8",
    );
    await widened.pass();
    assert.equal(
      widened.compiles(),
      2,
      "a project that admits JavaScript must treat a new .js file as membership",
    );
  } finally {
    widened.close();
  }
}

/**
 * Asserts the configured `outDir` is excluded by configuration rather than by
 * name, and that validation reads only what it compares.
 *
 * Two properties in one session, because both are about work the walk should
 * not do. The project's `outDir` is a name the ignore list never carried, so
 * only reading the configuration can exclude it. And a directory the walk does
 * enter must still not cost a read per file: validation compares content over
 * the generation's declared inputs alone, so reading anything else is work
 * whose result is never consulted. Before the fix, two hundred emitted files
 * cost hundreds of reads on the pass that first saw them.
 */
export async function assertTheWalkAvoidsWorkItCannotUse(): Promise<void> {
  const session = await startMembershipSession({ outDir: "generated" });
  try {
    await session.pass();
    await session.pass();
    const settled = session.reads();

    const excluded = path.join(session.root, "generated");
    fs.mkdirSync(excluded, { recursive: true });
    for (let index = 0; index < 40; index += 1) {
      fs.writeFileSync(
        path.join(excluded, `chunk-${index}.js`),
        `// ${index}\n`,
        "utf8",
      );
    }
    await session.pass();
    assert.equal(
      session.compiles(),
      1,
      "the configured outDir must not void the generation",
    );

    // A directory the walk does enter, because no configuration excludes it,
    // holding only files this project could never compile. Neither the
    // directory's appearance nor anything accumulating in it is a membership
    // change, because its subtree cannot hold a program input. That is the
    // whole output-directory case, for any name rather than for fifteen.
    const walked = path.join(session.root, "assets");
    fs.mkdirSync(walked, { recursive: true });
    const before = session.reads();
    for (let index = 0; index < 40; index += 1) {
      fs.writeFileSync(
        path.join(walked, `asset-${index}.js`),
        `// ${index}\n`,
        "utf8",
      );
    }
    await session.pass();
    assert.equal(
      session.compiles(),
      1,
      "a directory that cannot hold program inputs must not void the generation",
    );
    assert.ok(
      session.reads() - before <= settled,
      `validation must not read files it never compares (read ${session.reads() - before}, settled pass reads ${settled})`,
    );

    // The moment that same directory can hold one, it counts. The walk still
    // enters and still watches an irrelevant directory precisely so this
    // transition is seen rather than missed.
    fs.writeFileSync(
      path.join(walked, "late.ts"),
      "export const late: number = 1;",
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a source appearing in a previously irrelevant directory must be detected",
    );
  } finally {
    session.close();
  }
}

import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject, projectModules } from "./transform-project-cache";

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
async function startMembershipSession(
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
 * Asserts an overlay `outDir` replaces the inherited directory exclusion and
 * that validation reads only what it compares.
 *
 * Two properties in one session, because both are about the effective program.
 * The replacement directory must remain outside the walk while the inherited
 * one becomes eligible again. A directory the walk enters must still not cost a
 * read per irrelevant file: validation compares content over the generation's
 * declared inputs alone, so reading anything else is wasted work.
 */
export async function assertTheWalkAvoidsWorkItCannotUse(): Promise<void> {
  const session = await startMembershipSession(
    { outDir: "src" },
    { outDir: "${configDir}\\generated" },
  );
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
    fs.writeFileSync(
      path.join(excluded, "emitted.ts"),
      "export const emitted: number = 1;\n",
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      1,
      "the configured outDir must not void the generation",
    );

    // The inherited outDir no longer excludes this directory after the caller
    // replaces that option. Files this project cannot compile still do not
    // change membership, and validation must not read them.
    const walked = path.join(session.root, "src");
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

    // The moment that same directory gains a source, it counts. This is the
    // inherited-output replacement boundary: preserving the old outDir in the
    // merged policy would miss the creation, every later edit, and removal.
    const admitted = path.join(walked, "late.ts");
    fs.writeFileSync(admitted, "export const late: number = 1;", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a source appearing under the replaced inherited outDir must be detected",
    );

    fs.writeFileSync(admitted, "export const late: number = 2;", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "editing a source under the replaced inherited outDir must be detected",
    );

    fs.rmSync(admitted);
    await session.pass();
    assert.equal(
      session.compiles(),
      4,
      "removing a source under the replaced inherited outDir must be detected",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a host with no build boundary is not charged for emitted output
 * either.
 *
 * The other half of samchon/ttsc#1307, and the half every pass-based case is
 * blind to. `@ttsc/metro`, the Turbopack loader and a watching Vite dev server
 * never call `beginTtscTransformBuild`, so their deliveries go through the live
 * mutation tracker rather than through the pass gate's whole-generation proof.
 * The tracker has to answer the same question the membership digest does, or
 * the two disagree about one project: a content-hashed bundle fires a rename
 * per rebuild, and treating that as a membership change kept the whole cost on
 * exactly the hosts the narrow path exists for.
 */
export async function assertAPersistentHostIgnoresEmittedOutput(): Promise<void> {
  const session = await startMembershipSession();
  try {
    await session.deliver();
    assert.equal(session.compiles(), 1);
    await session.deliver();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    // The output directory appears. A live tracker has to treat a new
    // directory as membership, because it cannot know what will be put in it
    // and it is not watching it yet, so this one costs a compile.
    emitHashedBundle(session.root, "lib", 1);
    await session.deliver();
    const settled = session.compiles();

    // What must cost nothing is every rebuild after it, which is where the
    // defect lived: content-hashed filenames change the directory's membership
    // on every build, and the tracker used to report each one.
    for (let build = 2; build <= 5; build += 1) {
      emitHashedBundle(session.root, "lib", build);
      await session.deliver();
    }
    assert.equal(
      session.compiles(),
      settled,
      "a persistent host must not recompile per rebuild for output it cannot admit",
    );

    // The same host must still see a real one.
    fs.writeFileSync(
      path.join(session.root, "src", "late.ts"),
      "export const late: number = 1;",
      "utf8",
    );
    await session.deliver();
    assert.equal(
      session.compiles(),
      settled + 1,
      "a persistent host must still see a source entering the program",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts the walk and `isProjectWalkPath` answer the same question.
 *
 * `selectExternalInputPaths` uses that predicate as the sole test for "the walk
 * already covers this", and records everything else as an out-of-walk input to
 * be proven by content and physical identity. So the two must agree exactly.
 * Making the walk configuration-aware while the predicate stayed permissive
 * would put a graph input the compiler really read into neither snapshot:
 * absent from `inputHashes` because the walk skipped its directory, and absent
 * from the out-of-walk snapshot because the predicate claimed the walk had it.
 * On a pass-based host that is silent staleness, and on a persistent one it is
 * a whole-project recompile per delivery, forever.
 *
 * Asserted against the predicate directly, because the disagreement is between
 * two functions rather than in either one's own behaviour.
 */
export async function assertTheWalkPredicateMatchesTheWalk(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 1,
    outDir: "src/inherited-output",
  });
  const tsconfig = path.join(project.root, "tsconfig.json");
  const declared = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions: Record<string, unknown>;
    extends?: string;
  };
  delete declared.compilerOptions.outDir;
  const configOwner = path.join(project.root, "config");
  const baseConfig = path.join(configOwner, "tsconfig.base.json");
  fs.mkdirSync(configOwner, { recursive: true });
  fs.writeFileSync(
    baseConfig,
    JSON.stringify({
      compilerOptions: {
        declarationDir: "..\\src\\inherited-declarations",
        outDir: "..\\src\\inherited-output",
      },
    }),
    "utf8",
  );
  declared.extends = ".\\config\\tsconfig.base.json";
  fs.writeFileSync(tsconfig, JSON.stringify(declared, null, 2), "utf8");

  const policy = api.readProjectMembershipPolicy(tsconfig);
  const overlayOwner = path.join(project.root, "adapter-owner");
  const merged = api.mergeMembershipPolicyOverlay(
    policy,
    { declarationDir: "types", outDir: "build" },
    overlayOwner,
  );
  const walkSees = (
    candidatePolicy: typeof policy,
    relative: string,
  ): boolean =>
    api.isProjectWalkPath(
      project.root,
      path.join(project.root, ...relative.split("/")),
      undefined,
      undefined,
      candidatePolicy,
    );

  // Materialized, every one of them. `isProjectWalkPath` rejects a path that
  // does not exist before it ever reaches the exclusion or extension checks, so
  // asserting on absent paths would pass whatever the policy said and pin
  // nothing at all.
  for (const relative of [
    "src/inherited-output/helper.ts", // the inherited `outDir`
    "src/inherited-declarations/helper.ts", // inherited `declarationDir`
    "src/retained/helper.ts", // an explicit exclusion in the boundary policy
    "adapter-owner/build/helper.ts", // the overlay `outDir`
    "adapter-owner/types/helper.ts", // the overlay `declarationDir`
    "src/bundle.js", // an extension this program cannot admit
    "node_modules/dep/index.ts", // the name-based residue
  ]) {
    const absolute = path.join(project.root, ...relative.split("/"));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "export const planted: number = 1;", "utf8");
  }

  assert.equal(walkSees(policy, "src/inherited-output/helper.ts"), false);
  assert.equal(walkSees(policy, "src/inherited-declarations/helper.ts"), false);
  assert.equal(
    walkSees(merged, "src/inherited-output/helper.ts"),
    true,
    "replacing outDir must admit the directory contributed by the inherited option",
  );
  assert.equal(
    walkSees(merged, "src/inherited-declarations/helper.ts"),
    true,
    "replacing declarationDir must admit the directory contributed by the inherited option",
  );
  for (const relative of [
    "adapter-owner/build/helper.ts",
    "adapter-owner/types/helper.ts",
    "src/bundle.js",
    "node_modules/dep/index.ts",
  ]) {
    assert.equal(
      walkSees(merged, relative),
      false,
      `${relative} is not hashed by the merged walk, so the predicate must not claim it is`,
    );
  }

  assert.deepEqual(
    merged.inputExtensions,
    policy.inputExtensions,
    "path-valued overlays must not change allowJs or resolveJsonModule membership",
  );
  assert.deepEqual(
    api.mergeMembershipPolicyOverlay(policy, {}, overlayOwner)
      .excludedDirectories,
    policy.excludedDirectories,
    "without an overlay, inherited output directories must remain excluded",
  );
  assert.equal(
    policy.directoryExclusionOrigins?.outDir,
    path.join(project.root, "src", "inherited-output"),
    "an inherited outDir must remain anchored at the config that declared it",
  );
  assert.equal(
    policy.directoryExclusionOrigins?.declarationDir,
    path.join(project.root, "src", "inherited-declarations"),
    "an inherited declarationDir must remain anchored at its declaring config",
  );

  const emptyOverlay = api.mergeMembershipPolicyOverlay(
    policy,
    { declarationDir: "", outDir: "" },
    overlayOwner,
  );
  assert.equal(
    emptyOverlay.directoryExclusionOrigins?.outDir,
    overlayOwner,
    "an empty overlay outDir is still a path-valued replacement",
  );
  assert.equal(
    emptyOverlay.directoryExclusionOrigins?.declarationDir,
    overlayOwner,
    "an empty overlay declarationDir is still a path-valued replacement",
  );
  assert.ok(
    !emptyOverlay.excludedDirectories.includes(
      path.join(project.root, "src", "inherited-output"),
    ),
    "an empty output overlay must not retain the inherited output directory",
  );

  const emptyConfig = path.join(project.root, "tsconfig.empty.json");
  fs.writeFileSync(
    emptyConfig,
    JSON.stringify({
      compilerOptions: { declarationDir: "", outDir: "" },
      extends: "./config/tsconfig.base.json",
    }),
    "utf8",
  );
  const emptyPolicy = api.readProjectMembershipPolicy(emptyConfig);
  assert.equal(
    emptyPolicy.directoryExclusionOrigins?.outDir,
    project.root,
    "an empty child outDir must replace rather than fall through to its base",
  );
  assert.equal(
    emptyPolicy.directoryExclusionOrigins?.declarationDir,
    project.root,
    "an empty child declarationDir must replace rather than inherit",
  );

  const nullOverlay = api.mergeMembershipPolicyOverlay(
    policy,
    { declarationDir: null, outDir: null },
    overlayOwner,
  );
  assert.equal(nullOverlay.directoryExclusionOrigins?.outDir, undefined);
  assert.equal(
    nullOverlay.directoryExclusionOrigins?.declarationDir,
    undefined,
  );
  assert.deepEqual(
    nullOverlay.excludedDirectories,
    [],
    "null output overlays must clear rather than preserve inherited exclusions",
  );

  const nullConfig = path.join(project.root, "tsconfig.null.json");
  fs.writeFileSync(
    nullConfig,
    JSON.stringify({
      compilerOptions: { declarationDir: null, outDir: null },
      extends: "./config/tsconfig.base.json",
    }),
    "utf8",
  );
  const nullPolicy = api.readProjectMembershipPolicy(nullConfig);
  assert.equal(nullPolicy.directoryExclusionOrigins?.outDir, undefined);
  assert.equal(nullPolicy.directoryExclusionOrigins?.declarationDir, undefined);
  assert.deepEqual(
    nullPolicy.excludedDirectories,
    [],
    "null child output options must clear their inherited exclusions",
  );

  const templateBase = path.join(configOwner, "tsconfig.template.json");
  fs.writeFileSync(
    templateBase,
    JSON.stringify({
      compilerOptions: {
        declarationDir: "${configDir}\\template-types",
        outDir: "${configDir}\\template-output",
      },
      exclude: ["${configDir}\\template-exclude"],
    }),
    "utf8",
  );
  const templateConfig = path.join(project.root, "tsconfig.template.json");
  fs.writeFileSync(
    templateConfig,
    JSON.stringify({ extends: "./config/tsconfig.template.json" }),
    "utf8",
  );
  const templatePolicy = api.readProjectMembershipPolicy(templateConfig);
  assert.equal(
    templatePolicy.directoryExclusionOrigins?.outDir,
    path.join(project.root, "template-output"),
    "an inherited configDir outDir must use the resolved leaf config directory",
  );
  assert.equal(
    templatePolicy.directoryExclusionOrigins?.declarationDir,
    path.join(project.root, "template-types"),
    "an inherited configDir declarationDir must use the resolved leaf directory",
  );
  assert.deepEqual(
    templatePolicy.excludedDirectories,
    [path.join(project.root, "template-exclude")],
    "an inherited configDir exclude must use the resolved leaf config directory",
  );
  const templateOverlay = api.mergeMembershipPolicyOverlay(
    policy,
    {
      declarationDir: "${configDir}\\template-types",
      outDir: "${configDir}\\template-output",
    },
    overlayOwner,
  );
  assert.equal(
    templateOverlay.directoryExclusionOrigins?.outDir,
    path.join(overlayOwner, "template-output"),
    "an overlay configDir outDir must use the overlay owner",
  );
  assert.equal(
    templateOverlay.directoryExclusionOrigins?.declarationDir,
    path.join(overlayOwner, "template-types"),
    "an overlay configDir declarationDir must use the overlay owner",
  );

  const explicitConfig = path.join(project.root, "tsconfig.explicit.json");
  fs.writeFileSync(
    explicitConfig,
    JSON.stringify({
      compilerOptions: { outDir: "src\\retained" },
      exclude: ["src\\retained\\**"],
    }),
    "utf8",
  );
  const explicitPolicy = api.mergeMembershipPolicyOverlay(
    api.readProjectMembershipPolicy(explicitConfig),
    { outDir: "build" },
    overlayOwner,
  );
  assert.ok(
    explicitPolicy.excludedDirectories.includes(
      path.join(project.root, "src", "retained"),
    ),
    "an explicit exclude equal to the inherited outDir must survive its replacement",
  );
  assert.ok(
    !explicitPolicy.excludedDirectories.includes(
      path.join(overlayOwner, "build"),
    ),
    "an explicit exclude must replace TypeScript's implicit output exclusions",
  );
  assert.equal(walkSees(explicitPolicy, "src/retained/helper.ts"), false);
  assert.equal(
    walkSees(explicitPolicy, "adapter-owner/build/helper.ts"),
    true,
    "an output directory is admitted when an explicit exclude replaces the implicit default",
  );

  const emptyExcludeConfig = path.join(
    project.root,
    "tsconfig.empty-exclude.json",
  );
  fs.writeFileSync(
    emptyExcludeConfig,
    JSON.stringify({
      compilerOptions: { outDir: "src\\output" },
      exclude: [],
    }),
    "utf8",
  );
  assert.deepEqual(
    api.readProjectMembershipPolicy(emptyExcludeConfig).excludedDirectories,
    [],
    "even an empty explicit exclude must replace the implicit outDir exclusion",
  );

  const legacyDirectory = path.join(project.root, "legacy-exclusion");
  const legacyPolicy = api.mergeMembershipPolicyOverlay(
    {
      excludedDirectories: [legacyDirectory],
      inputExtensions: policy.inputExtensions,
      sources: policy.sources,
    },
    { outDir: "build" },
    overlayOwner,
  );
  assert.ok(
    legacyPolicy.excludedDirectories.includes(legacyDirectory),
    "a public policy without provenance must preserve its existing exclusions",
  );

  // And the walk really does not hash them, which is the other half of the
  // agreement: the predicate would be free to say anything if nothing checked
  // what the walk actually collected.
  const hashed = Object.keys(
    api.collectProjectInputHashes(project.root, undefined, undefined, merged),
  );
  for (const absent of [
    "adapter-owner/build/helper.ts",
    "adapter-owner/types/helper.ts",
    "src/bundle.js",
  ]) {
    assert.ok(
      !hashed.includes(absent),
      `the walk must not hash ${absent} (hashed: ${hashed.join(", ")})`,
    );
  }
  for (const admitted of [
    "src/inherited-output/helper.ts",
    "src/inherited-declarations/helper.ts",
  ]) {
    assert.ok(
      hashed.includes(admitted),
      `the merged walk must hash ${admitted} (hashed: ${hashed.join(", ")})`,
    );
  }

  const source = path.join(project.root, "src", "mod0.ts");
  fs.writeFileSync(source, "export const kept: number = 1;", "utf8");
  assert.equal(
    walkSees(merged, "src/mod0.ts"),
    true,
    "an ordinary source the walk does hash must still be claimed",
  );
}

/**
 * Asserts the files the compiler reads that are not sources are still proven
 * after the walk stopped hashing them.
 *
 * The walk now collects only files that could enter the program, which is what
 * keeps a tree of emitted output from costing a read per file. That is safe
 * only because the compiler's own non-source inputs are proven somewhere else:
 * the tsconfig, the package manifest and the plugin descriptor are universal
 * host inputs, validated by identity and content on every delivery rather than
 * by the project walk. If that were not so, narrowing the walk would have
 * silently stopped a tsconfig edit from invalidating anything, which is the
 * worst outcome this cycle could have produced (samchon/ttsc#1307).
 *
 * Each edit is its own pass, and each must cost exactly one compile.
 */
export async function assertNonSourceHostInputsAreStillProven(): Promise<void> {
  const session = await startMembershipSession({ fileCount: 2 });
  try {
    await session.pass();
    assert.equal(session.compiles(), 1);
    await session.pass();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    const tsconfig = path.join(session.root, "tsconfig.json");
    const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
      compilerOptions: Record<string, unknown>;
    };
    parsed.compilerOptions.target = "ES2021";
    fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a tsconfig edit must still replace the generation",
    );

    fs.writeFileSync(
      path.join(session.root, "package.json"),
      JSON.stringify({ private: true, type: "commonjs", version: "9.9.9" }),
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "a package manifest edit must still replace the generation",
    );

    const descriptor = path.join(session.root, "plugin.cjs");
    fs.writeFileSync(
      descriptor,
      `${fs.readFileSync(descriptor, "utf8")}\n// touched\n`,
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      4,
      "a plugin descriptor edit must still replace the generation",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts emptying and recreating the configured output directory costs
 * nothing, on a host with no build boundary.
 *
 * `emptyOutDir` and `output.clean` do exactly this on every build, so the event
 * arrives on the project root's own watch: the directory disappears and
 * reappears. The walk never descends into a configured `outDir`, so the
 * membership digest cannot see anything there, and a tracker that reported the
 * directory anyway would be the one side reacting to it, voiding the generation
 * once per build for the whole session.
 *
 * A plain `exclude` entry naming a _file_ is the boundary case in the other
 * direction: that file is still walked and still hashed, so its events must
 * keep counting.
 */
export async function assertRecreatingTheOutputDirectoryCostsNothing(): Promise<void> {
  const session = await startMembershipSession({
    outDir: "artifacts",
  });
  try {
    const artifacts = path.join(session.root, "artifacts");
    fs.mkdirSync(artifacts, { recursive: true });
    fs.writeFileSync(path.join(artifacts, "bundle.js"), "// one", "utf8");
    await session.deliver();
    const settled = session.compiles();

    for (let build = 1; build <= 3; build += 1) {
      fs.rmSync(artifacts, { force: true, recursive: true });
      fs.mkdirSync(artifacts, { recursive: true });
      fs.writeFileSync(
        path.join(artifacts, `bundle.${build}.js`),
        `// ${build}`,
        "utf8",
      );
      await session.deliver();
    }
    assert.equal(
      session.compiles(),
      settled,
      "recreating the configured output directory must not void the generation",
    );

    // An explicit top-level `exclude` replaces TypeScript's implicit output
    // exclusions. Install that separate boundary in the same session only
    // after the output-directory lifecycle above has proved the default.
    const tsconfig = path.join(session.root, "tsconfig.json");
    const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
      exclude?: string[];
    };
    parsed.exclude = ["src/legacy.ts"];
    fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");
    await session.deliver();
    const explicitExcludeSettled = session.compiles();

    // A plain `exclude` entry naming a file is not a directory exclusion. The
    // walk still hashes that file, so its appearance must keep counting.
    fs.writeFileSync(
      path.join(session.root, "src", "legacy.ts"),
      "export const legacy: number = 1;",
      "utf8",
    );
    await session.deliver();
    assert.ok(
      session.compiles() > explicitExcludeSettled,
      "a file the walk hashes must still report its own membership",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts the membership policy reports every config it consulted, including
 * one that is not there yet.
 *
 * A caller that memoizes a policy has to know when to stop trusting it, and the
 * leaf config alone cannot tell it: `allowJs`, `resolveJsonModule`, `outDir`,
 * `declarationDir` and `exclude` all resolve through the whole `extends` chain,
 * so adding `exclude` to a shared `tsconfig.base.json` changes every answer the
 * policy gives while leaving the leaf's own bytes untouched. `@ttsc/metro`
 * stamps this list in a worker that outlives many runs, and a stamp that missed
 * a config would hold a policy the next run's walk already disagreed with,
 * which is the both-sides-disagree hole the policy exists to close.
 *
 * A base that does not exist yet counts too, since it can be generated during
 * install or arrive with a branch switch, and its creation has to move the
 * stamp.
 */
export async function assertThePolicyReportsEveryConfigItRead(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1 });
  const leaf = path.join(project.root, "tsconfig.json");
  const base = path.join(project.root, "tsconfig.base.json");
  const declared = JSON.parse(fs.readFileSync(leaf, "utf8")) as {
    compilerOptions: Record<string, unknown>;
  };
  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base.json" }),
    "utf8",
  );

  // The base is absent, and its candidate path is still reported, because its
  // later creation changes the policy.
  const before = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    before.sources.includes(leaf),
    `the leaf must be reported (got ${before.sources.join(", ")})`,
  );
  assert.ok(
    before.sources.some((source: string) => path.resolve(source) === base),
    `an unresolved extends target must be reported (got ${before.sources.join(", ")})`,
  );

  // The extension-less spelling records both candidates the resolver tries,
  // since `./tsconfig.base` resolves to `tsconfig.base.json` and recording only
  // the literal name would leave the stamp unmoved when the file appears.
  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base" }),
    "utf8",
  );
  const extensionless = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    extensionless.sources.some(
      (source: string) => path.resolve(source) === base,
    ),
    `the resolver's .json candidate must be reported (got ${extensionless.sources.join(", ")})`,
  );
  // The resolver's `.json` test is case-sensitive, so `./base.JSON` really does
  // resolve to `base.JSON.json` on a case-sensitive filesystem, and the stamp
  // has to record that name. Asserted on what the policy reports rather than on
  // what resolves, so it holds on every platform.
  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base.JSON" }),
    "utf8",
  );
  const uppercase = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    uppercase.sources.some(
      (source: string) =>
        path.resolve(source) ===
        path.join(project.root, "tsconfig.base.JSON.json"),
    ),
    `the resolver's case-sensitive .json candidate must be reported (got ${uppercase.sources.join(", ")})`,
  );

  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base.json" }),
    "utf8",
  );

  // And once it exists, it decides an answer the leaf never mentions.
  fs.writeFileSync(base, JSON.stringify({ exclude: ["generated"] }), "utf8");
  const after = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    after.excludedDirectories.some(
      (directory: string) =>
        path.resolve(directory) === path.join(project.root, "generated"),
    ),
    `the base config's exclude must reach the policy (got ${after.excludedDirectories.join(", ")})`,
  );
  assert.ok(
    after.sources.some((source: string) => path.resolve(source) === base),
    "and the base must still be reported once it resolves",
  );
}

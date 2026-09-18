import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies the walk and `isProjectWalkPath` give the same answer.
 *
 * `selectExternalInputPaths` uses that predicate as the only test for "the walk
 * already covers this", and records everything else as an out-of-walk input. If
 * the walk became configuration-aware while the predicate stayed permissive, a
 * graph input the compiler read would land in neither snapshot, which is silent
 * staleness on a pass-based host and a whole-project recompile per delivery on
 * a persistent one. The check targets the predicate directly, because the
 * disagreement is between two functions.
 *
 * 1. Build a project whose inherited output and declaration directories, retained
 *    directories, owner directories, and `node_modules` cover every exclusion
 *    origin.
 * 2. Walk it, and ask the predicate about every file in each location.
 * 3. Assert the predicate answers yes exactly for the files the walk hashed.
 */
export async function test_transformttsc_the_walk_predicate_matches_the_walk(): Promise<void> {
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

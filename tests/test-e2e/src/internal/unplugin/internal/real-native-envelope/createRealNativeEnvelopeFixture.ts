import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import type { IRealNativeEnvelopeFixture } from "./IRealNativeEnvelopeFixture";
import { realNativeEnvelopeContributor } from "./realNativeEnvelopeContributor";

interface IRealNativeEnvelopeFixtureOptions {
  /** Stage config and declaration races across consecutive compile attempts. */
  raceInputsAcrossAttempts?: boolean;
  /** Include the full resolver-owner and module-suffix probe corpus. */
  resolutionCorpus?: boolean;
}

/**
 * Materialize a package-resolution fixture driven by ttsc's utility host.
 *
 * The manifest selects banner, paths, strip and the Program probe in the same
 * order as the utility experiment. The first three use actual package links;
 * the probe's non-main Go package comes from the shared source provider. Its
 * ApplyProgram observes the same invocation that produces the native graph. The
 * envelope profile uses a real nonblank banner and explicit empty strip lists.
 * Paths still rewrites the larger corpus's actual configured alias.
 */
export function createRealNativeEnvelopeFixture(
  options: IRealNativeEnvelopeFixtureOptions = {},
): IRealNativeEnvelopeFixture {
  TestUnpluginProject.ensureSharedCacheDir();
  const resolutionCorpus = options.resolutionCorpus === true;
  const root = TestProject.tmpdir("ttsc-unplugin-RealEnvelope-");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-real-envelope-log-"),
    "program-runs.bin",
  );
  const modules = [
    ...Array.from({ length: 4 }, (_, index) =>
      path.join(root, "src", `mod${index}.ts`),
    ),
    path.join(root, "src", "predicate.cts"),
  ];
  const declaration = path.join(
    root,
    "node_modules",
    "typed-dep",
    "dist",
    "index.d.ts",
  );
  const excludedDirectory =
    options.raceInputsAcrossAttempts === true ? "generated-next" : "generated";
  const excludedSource = path.join(
    root,
    "src",
    excludedDirectory,
    "ignored.ts",
  );
  const missingCandidate = path.join(
    root,
    "node_modules",
    "linked-pkg",
    "index.ts",
  );
  const fileCandidateDirectory = path.join(root, "node_modules", "punycode.js");
  const automaticTypesDirectory = path.join(root, "node_modules", "@types");
  const resolutionCandidateGroups: Record<string, string[]> = resolutionCorpus
    ? {
        "package exports subpath": [
          path.join(
            root,
            "node_modules",
            "exports-pkg",
            "dist",
            "feature.native.ts",
          ),
        ],
        "package main target": [
          path.join(root, "node_modules", "linked-pkg", "index.native.ts"),
        ],
        "package types target": [
          path.join(
            root,
            "node_modules",
            "typed-dep",
            "dist",
            "index.native.d.ts",
          ),
        ],
        paths: [path.join(root, "paths", "value.native.ts")],
        relative: [
          path.join(root, "src", "relative.native.ts"),
          path.join(root, "src", "relative.ts"),
          path.join(root, "src", "relative.native.tsx"),
          path.join(root, "src", "relative.tsx"),
          path.join(root, "src", "relative.native.d.ts"),
          path.join(root, "src", "relative.d.ts"),
          path.join(root, "src", "relative.native.js"),
          path.join(root, "src", "react.native.tsx"),
          path.join(root, "src", "react.tsx"),
          path.join(root, "src", "react.native.ts"),
          path.join(root, "src", "react.ts"),
          path.join(root, "src", "react.native.d.ts"),
          path.join(root, "src", "react.d.ts"),
          path.join(root, "src", "react.native.jsx"),
          path.join(root, "src", "esm.native.mts"),
          path.join(root, "src", "esm.mts"),
          path.join(root, "src", "esm.native.d.mts"),
          path.join(root, "src", "esm.d.mts"),
          path.join(root, "src", "esm.native.mjs"),
          path.join(root, "src", "common.native.cts"),
          path.join(root, "src", "common.cts"),
          path.join(root, "src", "common.native.d.cts"),
          path.join(root, "src", "common.d.cts"),
          path.join(root, "src", "common.native.cjs"),
        ],
        rootDirs: [
          path.join(root, "src", "rooted.native.ts"),
          path.join(root, "generated", "rooted.native.ts"),
        ],
      }
    : {};

  const fixtureRoot = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests",
    "test-e2e",
    "fixtures",
    "unplugin",
    "real-native-envelope",
  );
  copyFixtureLayer(path.join(fixtureRoot, "base"), root);
  if (resolutionCorpus) {
    copyFixtureLayer(path.join(fixtureRoot, "resolution"), root);
  }
  const scope = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(scope, { recursive: true });
  for (const name of ["banner", "paths", "strip"]) {
    fs.symlinkSync(
      path.join(TestProject.WORKSPACE_ROOT, "packages", name),
      path.join(scope, name),
      "junction",
    );
  }
  const config = path.join(root, "tsconfig.json");
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  const probe = parsed.compilerOptions.plugins.find(
    (entry: { transform?: string }) => entry.transform === "./plugin.cjs",
  );
  if (probe === undefined)
    throw new Error("Native envelope manifest has no Program probe");
  Object.assign(probe, {
    runLog,
    raceAttempt: options.raceInputsAcrossAttempts === true ? 99 : undefined,
    raceFile:
      options.raceInputsAcrossAttempts === true ? declaration : undefined,
    raceContent:
      options.raceInputsAcrossAttempts === true
        ? "export interface Shared { label: string; revision?: number; }\n"
        : undefined,
  });
  fs.writeFileSync(config, JSON.stringify(parsed, null, 2), "utf8");
  if (options.raceInputsAcrossAttempts === true) {
    const originalExcluded = path.join(root, "src", "generated", "ignored.ts");
    fs.mkdirSync(path.dirname(excludedSource), { recursive: true });
    fs.renameSync(originalExcluded, excludedSource);
  }
  fs.copyFileSync(
    path.join(TestUnpluginProject.sharedNativeFixtureSource(), "go.mod"),
    path.join(root, "go.mod"),
  );
  const contributorRoot = realNativeEnvelopeContributor();
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      "module.exports = (context) => ({",
      '  name: context.plugin.name ?? "real-envelope-compile-probe",',
      `  source: ${JSON.stringify(contributorRoot)},`,
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  return {
    automaticTypesDirectory,
    declaration,
    excludedSource,
    fileCandidateDirectory,
    missingCandidate,
    modules,
    resolutionCorpus,
    resolutionCandidateGroups,
    root,
    runLog,
  };
}

/** Copy authored dependencies to their runtime node_modules spelling. */
function copyFixtureLayer(source: string, root: string): void {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const input = path.join(source, entry.name);
    const output = path.join(
      root,
      entry.name === "dependencies" ? "node_modules" : entry.name,
    );
    if (entry.isDirectory()) TestProject.copyDirectory(input, output);
    else if (entry.isFile()) fs.copyFileSync(input, output);
  }
}

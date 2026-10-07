import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import type { ICacheProjectOptions } from "./ICacheProjectOptions";
import { externalSourceModules } from "./externalSourceModules";

/**
 * Materialize the synthetic cache project and its fixture transform plugin.
 *
 * The plugin records every compile to `runLog`, so a scenario counts real
 * whole-project transforms, and `options` shapes the envelope it reports.
 */
export function createCacheProject(options: ICacheProjectOptions): {
  root: string;
  runLog: string;
} {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const root = TestProject.tmpdir("ttsc-unplugin-cache-project-");
  const pluginSource =
    options.isolatedPluginSource === true
      ? path.join(root, "go-plugin")
      : TestUnpluginProject.sharedNativeFixtureSource();
  if (options.isolatedPluginSource === true)
    TestUnpluginProject.writeNativeFixtureSource(pluginSource);
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-cache-log-"),
    "plugin-runs.log",
  );
  const fileCount = options.fileCount ?? 6;
  const snapshotRaceFile = path.join(root, "src", "mod1.ts");
  const snapshotRaceMarker = path.join(
    TestProject.tmpdir("ttsc-unplugin-cache-race-"),
    "mutated",
  );
  const snapshotRaceOriginal = 'export const value1: string = "PROBE";\n';
  const snapshotRaceDuring = 'export const value1: string = "PROBE-DURING";\n';
  const externalRaceFile = path.join(
    TestProject.tmpdir("ttsc-unplugin-external-race-"),
    "external.d.ts",
  );
  if (options.externalSnapshotAbaRace === true) {
    fs.writeFileSync(externalRaceFile, "EXTERNAL-ORIGINAL\n", "utf8");
  }
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  for (let index = 0; index < fileCount; index += 1) {
    fs.writeFileSync(
      path.join(root, "src", `mod${index}.ts`),
      `export const value${index}: string = "PROBE";\n`,
      "utf8",
    );
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  if (options.nonInputRaceFile !== undefined) {
    // Materialize it before the first compile: the scenario is a file that
    // keeps changing, not one that appears. A new file is a membership change,
    // which the directory snapshot is supposed to catch.
    const target = path.join(root, options.nonInputRaceFile);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "seed\n", "utf8");
  }
  for (
    let index = 0;
    index < (options.unrelatedDirectoryCount ?? 0);
    index += 1
  ) {
    const directory = path.join(root, "fixtures", `unused-${index}`, "nested");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "asset.txt"), "fixture\n", "utf8");
  }
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: options.outDir ?? "dist",
          ...(options.allowJs === undefined
            ? {}
            : { allowJs: options.allowJs }),
          ...(options.resolveJsonModule === undefined
            ? {}
            : { resolveJsonModule: options.resolveJsonModule }),
          // Options live at the plugin-entry top level: the protocol forwards
          // the whole entry as the plugin's config object.
          plugins: [
            {
              transform: "./plugin.cjs",
              name: "cache-probe",
              fixtureProtocol: "cache",
              runLog,
              emitExternal: options.emitExternalKey === true,
              externalSourceOutputs: options.externalSourceOutputs ?? 0,
              externalSourceChangesAfterRead:
                options.externalSourceChangesAfterRead === true,
              aliasedGlobal:
                options.aliasedGlobal === true && process.platform !== "win32",
              graphFanout: options.graphFanout ?? 0,
              graphGlobals: options.graphGlobals ?? 0,
              lexicalCandidateProofFailureAlias:
                options.lexicalCandidateProofFailureAlias === true,
              graphCandidates: options.graphCandidates ?? 0,
              candidateProofFailure: options.candidateProofFailure === true,
              contradictoryRichCandidateProof:
                options.contradictoryRichCandidateProof === true,
              unprojectableContradictoryRichCandidateProof:
                options.unprojectableContradictoryRichCandidateProof === true,
              richCandidateProof: options.richCandidateProof === true,
              outOfProjectCandidate: options.outOfProjectCandidate ?? "",
              nonInputRaceFile: options.nonInputRaceFile ?? "",
              transformDelayMs: options.transformDelayMs ?? 0,
              ...(options.failingSource === undefined
                ? {}
                : {
                    failDelayMs: options.failingSource.delayMs,
                    failOnMarker: options.failingSource.marker,
                    failReadStamp: options.failingSource.readStamp,
                  }),
              unhashedGraphInput: options.unhashedGraphInput === true,
              unprovenGraphInput: options.unprovenGraphInput === true,
              unprovenGraphInputs: options.unprovenGraphInputs ?? 0,
              independentGraphLeaf: options.independentGraphLeaf,
              partitionGraph: options.partitionGraph === true,
              omitExternalSourceGraphNode:
                options.omitExternalSourceGraphNode === true,
              ...(options.snapshotAbaRace === true
                ? {
                    snapshotRaceDuring,
                    snapshotRaceFile,
                    snapshotRaceMarker,
                    snapshotRaceOriginal,
                  }
                : {}),
              ...(options.externalSnapshotAbaRace === true
                ? {
                    externalRaceFile,
                    externalRaceOriginal: "EXTERNAL-ORIGINAL\n",
                    snapshotRaceDuring: "EXTERNAL-DURING\n",
                    snapshotRaceFile: externalRaceFile,
                    snapshotRaceMarker,
                  }
                : {}),
              ...(options.externalSourceChangesAfterRead === true
                ? { snapshotRaceMarker }
                : {}),
            },
          ],
        },
        include: ["src"],
        ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
      },
      null,
      2,
    ),
    "utf8",
  );
  const unreadableHostInput = path.join(
    root,
    "node_modules",
    "host-input.json",
  );
  if (options.unreadableHostInput === true) {
    fs.mkdirSync(path.dirname(unreadableHostInput), { recursive: true });
    // A link with no target: it exists, so its own metadata is stable and
    // readable, while every attempt to read through it fails for the host and
    // the adapter alike. That is the state a missing marker records.
    fs.symlinkSync(
      path.join(root, "node_modules", "host-input-target.json"),
      unreadableHostInput,
      process.platform === "win32" ? "junction" : "file",
    );
  }
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      ...(options.unreadableHostInput === true
        ? [
            'const crypto = require("node:crypto");',
            'const fs = require("node:fs");',
          ]
        : []),
      ...(options.unreadableHostInput === true
        ? [
            "",
            "function observedHash(file) {",
            '  try { if (fs.statSync(file).isDirectory()) return crypto.createHash("sha256").update("ttsc:host-input:directory\\0").digest("hex"); } catch {}',
            '  try { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }',
            "  catch { return null; }",
            "}",
            "function observedRealpath(file) {",
            "  try { return fs.realpathSync.native(file); }",
            "  catch { return null; }",
            "}",
          ]
        : []),
      "",
      "module.exports = (context) => {",
      "  return {",
      '    name: context.plugin.name ?? "cache-probe",',
      ...(options.unreadableHostInput === true
        ? [
            // Report what this host actually observed, exactly as the
            // descriptor of the neighbouring case does. A declared constant
            // would encode one classification of an unreadable path, and ttsc
            // revalidates a declared hash against its own filesystem.
            `    hostInputs: [${JSON.stringify(unreadableHostInput)}],`,
            `    hostInputHashes: { [${JSON.stringify(unreadableHostInput)}]: observedHash(${JSON.stringify(unreadableHostInput)}) },`,
            `    hostInputRealpaths: { [${JSON.stringify(unreadableHostInput)}]: observedRealpath(${JSON.stringify(unreadableHostInput)}) },`,
          ]
        : []),
      `    source: ${JSON.stringify(pluginSource)},`,
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  if (options.emitExternalKey === true) {
    // The validator's directory walk skips node_modules; this file only has to
    // exist so the pre-fix store-side overlay could read and key it.
    const depDir = path.join(root, "node_modules", "dep");
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, "types.d.css.ts"),
      "export {};\n",
      "utf8",
    );
  }
  for (const file of externalSourceModules(
    root,
    options.externalSourceOutputs ?? 0,
  )) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'export const external = "PROBE";\n', "utf8");
  }
  const graphFanout = options.graphFanout ?? 0;
  for (let index = 0; index < graphFanout; index += 1) {
    // The graph envelope's external targets must exist: the store-time
    // snapshot hashes every recorded external input.
    const depDir = path.join(root, "node_modules", `dep${index}`);
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, "index.d.ts"),
      `export declare const dep${index}: number;\n`,
      "utf8",
    );
  }
  if (
    options.richCandidateProof === true ||
    options.contradictoryRichCandidateProof === true ||
    options.unprojectableContradictoryRichCandidateProof === true
  ) {
    fs.writeFileSync(
      path.join(root, "node_modules", "dep0", "index.ts"),
      "export const present = true;\n",
      "utf8",
    );
  }
  for (let index = 0; index < (options.graphGlobals ?? 0); index += 1) {
    // Global-scope declarations the envelope reports for every module. They sit
    // outside the project walk exactly like a real `@types/*` package.
    const globalDir = path.join(root, "node_modules", `global${index}`);
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, "index.d.ts"),
      `declare const ambient${index}: number;\n`,
      "utf8",
    );
  }
  if (options.aliasedGlobal === true && process.platform !== "win32") {
    // One physical file under two spellings: the alias and its target share an
    // identity but not their metadata.
    const globalDir = path.join(root, "node_modules", "global0");
    fs.symlinkSync(
      path.join(globalDir, "index.d.ts"),
      path.join(globalDir, "alias.d.ts"),
      "file",
    );
  }
  if (options.lexicalCandidateProofFailureAlias === true) {
    const targetDir = path.join(root, "node_modules", "candidate-target");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "index.ts"),
      "export const candidate = true;\n",
      "utf8",
    );
    fs.symlinkSync(
      targetDir,
      path.join(root, "node_modules", "candidate-alias"),
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  return { root, runLog };
}

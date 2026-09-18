import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import type { ICacheProjectOptions } from "./ICacheProjectOptions";
import { externalSourceModules } from "./externalSourceModules";

let sharedCachePluginRoot: string | undefined;

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
      : (sharedCachePluginRoot ??= TestUnpluginProject.materializeSharedSource(
          "cache-go-plugin",
          writeGoPlugin,
        ));
  if (options.isolatedPluginSource === true) writeGoPlugin(pluginSource);
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

/**
 * Write the multi-file counting transform sidecar.
 *
 * This is a synthetic protocol double, not the production driver host. Its
 * local envelope fields intentionally support adversarial, contradictory, and
 * race-specific states; the real-host cache gate under `native-plugins/cache`
 * owns semantic calibration against `driver.NewTransformGraph`.
 *
 * It echoes every `src/*.ts` file (rewriting the `PROBE` marker so output
 * differs from input), appends one byte to the configured `runLog` per
 * invocation so the test can count whole-project transforms, and optionally
 * emits one out-of-walk output key.
 */
function writeGoPlugin(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "go.mod"),
    "module example.com/ttscunplugincacheprobe\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(dir, "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "crypto/sha256"',
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      '  "strings"',
      '  "time"',
      ")",
      "",
      "type pluginDescriptor struct {",
      '  Config map[string]any `json:"config"`',
      "}",
      "",
      "type graphSection struct {",
      '  Edges   map[string][]string `json:"edges"`',
      '  Globals []string            `json:"globals"`',
      '  Configs []string            `json:"configs"`',
      '  Candidates map[string][]string `json:"candidates,omitempty"`',
      '  InputHashes map[string]*string `json:"inputHashes,omitempty"`',
      '  InputRealpaths map[string]*string `json:"inputRealpaths,omitempty"`',
      '  InputProofFailures map[string]string `json:"inputProofFailures,omitempty"`',
      '  InputObservations map[string]map[string]any `json:"inputObservations,omitempty"`',
      "}",
      "",
      "type transformResult struct {",
      '  TypeScript map[string]string `json:"typescript"`',
      '  Graph      *graphSection     `json:"graph,omitempty"`',
      "}",
      "",
      "func main() { os.Exit(run(os.Args[1:])) }",
      "",
      "func run(args []string) int {",
      "  if len(args) == 0 { return 2 }",
      "  switch args[0] {",
      '  case "transform":',
      "    return transform(args[1:])",
      '  case "check", "version", "build":',
      "    return 0",
      "  default:",
      '    fmt.Fprintf(os.Stderr, "cache-probe: unknown command %q\\n", args[0])',
      "    return 2",
      "  }",
      "}",
      "",
      "func transform(args []string) int {",
      '  fs := flag.NewFlagSet("transform", flag.ContinueOnError)',
      "  fs.SetOutput(os.Stderr)",
      '  cwd := fs.String("cwd", "", "")',
      '  fs.String("tsconfig", "", "")',
      '  pluginsJSON := fs.String("plugins-json", "", "")',
      "  if err := fs.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      "  cfg := firstConfig(*pluginsJSON)",
      "",
      '  if logPath := stringValue(cfg, "runLog"); logPath != "" {',
      "    if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {",
      '      f.WriteString("x")',
      "      f.Close()",
      "    }",
      "  }",
      "",
      "  ts := map[string]string{}",
      "  observedInputs := map[string]string{}",
      // Write one file that is not an input of this compile while the compile
      // runs, the way a framework's type generator, a coverage reporter, or a
      // log writes inside a project root. The bytes differ on every run, so a
      // generation that compared it would never be reusable.
      '  if nonInput := stringValue(cfg, "nonInputRaceFile"); nonInput != "" {',
      "    target := nonInput",
      "    if !filepath.IsAbs(target) { target = filepath.Join(root, filepath.FromSlash(nonInput)) }",
      "    os.MkdirAll(filepath.Dir(target), 0o755)",
      '    os.WriteFile(target, []byte(fmt.Sprintf("run-%d\\n", time.Now().UnixNano())), 0o644)',
      "  }",
      '  srcDir := filepath.Join(root, "src")',
      "  entries, err := os.ReadDir(srcDir)",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  names := []string{}",
      "  for _, e := range entries {",
      '    if e.IsDir() || !strings.HasSuffix(e.Name(), ".ts") { continue }',
      "    names = append(names, e.Name())",
      "  }",
      "  for _, name := range names {",
      "    file := filepath.Join(srcDir, name)",
      '    raceFile := stringValue(cfg, "snapshotRaceFile")',
      '    raceMarker := stringValue(cfg, "snapshotRaceMarker")',
      "    raced := false",
      '    if raceFile != "" && filepath.Clean(file) == filepath.Clean(raceFile) && raceMarker != "" {',
      "      if _, statErr := os.Stat(raceMarker); os.IsNotExist(statErr) {",
      '        os.WriteFile(raceMarker, []byte("1"), 0o644)',
      '        os.WriteFile(file, []byte(stringValue(cfg, "snapshotRaceDuring")), 0o644)',
      "        raced = true",
      "      }",
      "    }",
      "    data, err := os.ReadFile(file)",
      "    if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '    input := "src/"+name',
      "    observedInputs[input] = string(data)",
      '    ts[input] = strings.ReplaceAll(string(data), "PROBE", "PROBED")',
      '    if raced && raceFile != "" && filepath.Clean(file) == filepath.Clean(raceFile) && stringValue(cfg, "snapshotRaceOriginal") != "" {',
      '      if err := os.WriteFile(raceFile, []byte(stringValue(cfg, "snapshotRaceOriginal")), 0o644); err != nil { fmt.Fprintln(os.Stderr, err); return 2 }',
      "    }",
      "  }",
      '  for j := 0; j < int(numberValue(cfg, "externalSourceOutputs")); j++ {',
      '    input := fmt.Sprintf("node_modules/external-source/mod%d.ts", j)',
      "    file := filepath.Join(root, filepath.FromSlash(input))",
      "    data, readErr := os.ReadFile(file)",
      "    if readErr != nil { fmt.Fprintln(os.Stderr, readErr); return 2 }",
      "    observedInputs[input] = string(data)",
      '    if j == 0 && boolValue(cfg, "externalSourceChangesAfterRead") {',
      '      marker := stringValue(cfg, "snapshotRaceMarker")',
      "      if _, statErr := os.Stat(marker); os.IsNotExist(statErr) {",
      '        os.WriteFile(marker, []byte("1"), 0o644)',
      '        os.WriteFile(file, []byte("export const external = \\"PROBE-AFTER\\";\\n"), 0o644)',
      "      }",
      "    }",
      '    ts[input] = strings.ReplaceAll(string(data), "PROBE", "PROBED")',
      "  }",
      '  externalRaceFile := stringValue(cfg, "externalRaceFile")',
      '  externalRaceOriginal := stringValue(cfg, "externalRaceOriginal")',
      '  externalRaceText := ""',
      '  if externalRaceFile != "" {',
      "    externalRaced := false",
      '    raceMarker := stringValue(cfg, "snapshotRaceMarker")',
      '    if raceMarker != "" {',
      "      if _, statErr := os.Stat(raceMarker); os.IsNotExist(statErr) {",
      '        os.WriteFile(raceMarker, []byte("1"), 0o644)',
      '        os.WriteFile(externalRaceFile, []byte(stringValue(cfg, "snapshotRaceDuring")), 0o644)',
      "        externalRaced = true",
      "      }",
      "    }",
      "    data, readErr := os.ReadFile(externalRaceFile)",
      "    if readErr != nil { fmt.Fprintln(os.Stderr, readErr); return 2 }",
      "    externalRaceText = string(data)",
      "    observedInputs[externalRaceFile] = externalRaceText",
      '    for key, value := range ts { ts[key] = value + "// " + strings.TrimSpace(externalRaceText) + "\\n" }',
      '    if externalRaced && externalRaceOriginal != "" {',
      "      if writeErr := os.WriteFile(externalRaceFile, []byte(externalRaceOriginal), 0o644); writeErr != nil { fmt.Fprintln(os.Stderr, writeErr); return 2 }",
      "    }",
      "  }",
      '  if boolValue(cfg, "emitExternal") {',
      '    ts["node_modules/dep/types.d.css.ts"] = "export {};\\n"',
      "  }",
      "",
      "  result := transformResult{TypeScript: ts}",
      '  if fanout := int(numberValue(cfg, "graphFanout")); fanout > 0 {',
      "    externals := make([]string, 0, fanout)",
      "    for j := 0; j < fanout; j++ {",
      '      externals = append(externals, fmt.Sprintf("node_modules/dep%d/index.d.ts", j))',
      "    }",
      "    edges := map[string][]string{}",
      "    for i, name := range names {",
      "      targets := []string{}",
      '      independentGraphLeaf := stringValue(cfg, "independentGraphLeaf")',
      '      if independentGraphLeaf != "" {',
      '        if "src/"+name != independentGraphLeaf { targets = append(targets, externals...) }',
      '      } else if boolValue(cfg, "partitionGraph") {',
      "        targets = append(targets, externals[i%len(externals)])",
      "      } else {",
      "        for _, other := range names {",
      '          if other != name { targets = append(targets, "src/"+other) }',
      "        }",
      "        targets = append(targets, externals...)",
      "      }",
      '      edges["src/"+name] = targets',
      "    }",
      '    if !boolValue(cfg, "omitExternalSourceGraphNode") {',
      '      for j := 0; j < int(numberValue(cfg, "externalSourceOutputs")); j++ {',
      '        edges[fmt.Sprintf("node_modules/external-source/mod%d.ts", j)] = []string{}',
      "      }",
      "    }",
      "    result.Graph = &graphSection{",
      "      Edges:      edges,",
      "      Globals:    []string{},",
      '      Configs:    []string{"tsconfig.json"},',
      "      InputHashes: map[string]*string{},",
      "      InputRealpaths: map[string]*string{},",
      "      InputProofFailures: map[string]string{},",
      "      InputObservations: map[string]map[string]any{},",
      "    }",
      "    for input, observed := range observedInputs { addGraphInputProof(result.Graph, root, input, observed) }",
      '    addGraphInputProof(result.Graph, root, "tsconfig.json", "")',
      '    for _, input := range externals { addGraphInputProof(result.Graph, root, input, "") }',
      '    if boolValue(cfg, "unhashedGraphInput") {',
      '      result.Graph.InputHashes["node_modules/dep0/index.d.ts"] = nil',
      "    }",
      // Superseding resolution candidates, exactly as the real host emits
      // them: higher-priority spellings the resolver never selected, and
      // therefore never read, so no compiler proof exists for them. The host
      // enumerates them speculatively (driver/resolution_candidates.go), which
      // is why addGraphInputProof is deliberately not called here.
      '    outside := stringValue(cfg, "outOfProjectCandidate")',
      '    if probes := int(numberValue(cfg, "graphCandidates")); probes > 0 || outside != "" {',
      "      result.Graph.Candidates = map[string][]string{}",
      "      for _, name := range names {",
      "        spellings := make([]string, 0, probes+1)",
      "        for j := 0; j < probes; j++ {",
      '          spellings = append(spellings, fmt.Sprintf("node_modules/dep%d/index.ts", j))',
      "        }",
      // An absolute spelling outside the project root, which the adapter keeps
      // probing because no watch of its chain can stay inside the bound.
      '        if outside != "" { spellings = append(spellings, outside) }',
      '        result.Graph.Candidates["src/"+name] = spellings',
      "      }",
      "    }",
      '    if boolValue(cfg, "candidateProofFailure") {',
      '      result.Graph.InputProofFailures["node_modules/dep0/index.ts"] = "file-exists-changed"',
      "    }",
      '    if boolValue(cfg, "richCandidateProof") {',
      '      candidate := "node_modules/dep0/index.ts"',
      '      result.Graph.InputObservations[candidate] = map[string]any{"fileExists": true}',
      '      result.Graph.InputProofFailures[candidate] = "content-unavailable"',
      '      missingCandidate := "node_modules/dep1/index.ts"',
      '      result.Graph.InputObservations[missingCandidate] = map[string]any{"fileExists": false}',
      "    }",
      '    if boolValue(cfg, "contradictoryRichCandidateProof") {',
      '      candidate := "node_modules/dep0/index.ts"',
      "      file := filepath.Join(root, filepath.FromSlash(candidate))",
      "      data, _ := os.ReadFile(file)",
      "      digest := sha256.Sum256(data)",
      '      observedHash := fmt.Sprintf("%x", digest[:])',
      "      realpath, _ := filepath.EvalSymlinks(file)",
      "      absolute, _ := filepath.Abs(realpath)",
      '      result.Graph.InputObservations[candidate] = map[string]any{"fileExists": true, "stat": "file", "readFile": map[string]any{"ok": true, "hash": observedHash}, "realpath": map[string]any{"ok": true, "path": absolute}}',
      '      addGraphInputProof(result.Graph, root, candidate, "")',
      '      contradictoryHash := strings.Repeat("0", 64)',
      "      result.Graph.InputHashes[candidate] = &contradictoryHash",
      "    }",
      '    if boolValue(cfg, "unprojectableContradictoryRichCandidateProof") {',
      '      candidate := "node_modules/dep0/index.ts"',
      '      result.Graph.InputObservations[candidate] = map[string]any{"fileExists": true}',
      '      addGraphInputProof(result.Graph, root, candidate, "")',
      "    }",
      '    unprovenInputs := int(numberValue(cfg, "unprovenGraphInputs"))',
      '    if boolValue(cfg, "unprovenGraphInput") && unprovenInputs == 0 { unprovenInputs = 1 }',
      // A realized edge target whose proof the host could not produce. Unlike a
      // candidate, the compile read this file, so the generation stays
      // unprovable and must not be reused.
      "    for j := 0; j < unprovenInputs; j++ {",
      '      input := fmt.Sprintf("node_modules/dep%d/index.d.ts", j)',
      "      delete(result.Graph.InputHashes, input)",
      "      delete(result.Graph.InputRealpaths, input)",
      '      result.Graph.InputProofFailures[input] = "content-unavailable"',
      "    }",
      '    if boolValue(cfg, "aliasedGlobal") {',
      '      alias := "node_modules/global0/alias.d.ts"',
      "      result.Graph.Globals = append(result.Graph.Globals, alias)",
      '      addGraphInputProof(result.Graph, root, alias, "")',
      "    }",
      '    if boolValue(cfg, "lexicalCandidateProofFailureAlias") {',
      '      target := "node_modules/candidate-target/index.ts"',
      '      alias := "node_modules/candidate-alias/index.ts"',
      "      if result.Graph.Candidates == nil { result.Graph.Candidates = map[string][]string{} }",
      '      for _, name := range names { result.Graph.Candidates["src/"+name] = append(result.Graph.Candidates["src/"+name], target, alias) }',
      '      addGraphInputProof(result.Graph, root, target, "")',
      '      result.Graph.InputProofFailures[alias] = "content-unavailable"',
      "    }",
      '    for j := 0; j < int(numberValue(cfg, "graphGlobals")); j++ {',
      '      global := fmt.Sprintf("node_modules/global%d/index.d.ts", j)',
      "      result.Graph.Globals = append(result.Graph.Globals, global)",
      '      addGraphInputProof(result.Graph, root, global, "")',
      "    }",
      '    if externalRaceFile != "" {',
      '      result.Graph.Edges["src/mod0.ts"] = append(result.Graph.Edges["src/mod0.ts"], externalRaceFile)',
      "      addGraphInputProof(result.Graph, root, externalRaceFile, externalRaceText)",
      "    }",
      "  }",
      "",
      "  data, _ := json.Marshal(result)",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
      "}",
      "",
      "func addGraphInputProof(graph *graphSection, root, input, observed string) {",
      "  file := input",
      "  if !filepath.IsAbs(file) { file = filepath.Join(root, filepath.FromSlash(file)) }",
      "  data := []byte(observed)",
      '  if observed == "" { data, _ = os.ReadFile(file) }',
      "  digest := sha256.Sum256(data)",
      '  hash := fmt.Sprintf("%x", digest[:])',
      "  realpath, err := filepath.EvalSymlinks(file)",
      "  if err != nil { graph.InputHashes[input] = nil; graph.InputRealpaths[input] = nil; return }",
      "  absolute, err := filepath.Abs(realpath)",
      "  if err != nil { return }",
      "  graph.InputHashes[input] = &hash",
      "  graph.InputRealpaths[input] = &absolute",
      "}",
      "",
      "func firstConfig(input string) map[string]any {",
      '  if input == "" { return nil }',
      "  var plugins []pluginDescriptor",
      "  if err := json.Unmarshal([]byte(input), &plugins); err != nil { return nil }",
      "  if len(plugins) == 0 { return nil }",
      "  return plugins[0].Config",
      "}",
      "",
      "func stringValue(config map[string]any, key string) string {",
      "  value, _ := config[key].(string)",
      "  return value",
      "}",
      "",
      "func boolValue(config map[string]any, key string) bool {",
      "  value, _ := config[key].(bool)",
      "  return value",
      "}",
      "",
      "func numberValue(config map[string]any, key string) float64 {",
      "  value, _ := config[key].(float64)",
      "  return value",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

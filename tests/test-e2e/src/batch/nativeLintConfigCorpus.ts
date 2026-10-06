import { TestLint, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../packages/ttsc/lib/index.js";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { lintGoPath } from "../internal/lint/internal/config-file";
import {
  type TraceMeasurements,
  readE2eTraceMeasurements,
} from "../internal/readE2eTraceMeasurements";
import { readE2eTracePayload } from "../internal/readE2eTracePayload";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies typed contributor/config discovery and native CLI diagnostic
 * transport.
 *
 * The existing two CLIs also own basic typed/CJS routing. Their actual loader
 * invocation carries returned raw bytes, child success and accepted dependency
 * normalization. Dependency tracking may remain unavailable without denying a
 * correctly loaded rule value; this transfer does not certify cache reuse. The
 * CJS warning module also extends a pure format-only child. Its exact raw width
 * survives the same actual command without introducing another launcher. The
 * same CJS invocation resolves two missing absolute manifest mains through
 * their literal fallbacks and one owned main. Exact entry/watch observations,
 * owned directory/watch and filesystem-root exclusion preserve the original
 * resolution graph boundary without a separate evaluator. A configured
 * observation sink is borrowed; otherwise the existing opt-in writer is enabled
 * only in these children with an owned trace-only allocation. No additional
 * launcher is introduced; the warning DAG now includes a second real typed
 * evaluation after a helper-only edit, including its required preparation.
 *
 * 1. Run one typed-config graph containing all original contributor and mixed
 *    stream inputs.
 * 2. Contrast one CJS warning-only command with the error graph's native stream.
 * 3. Compile config-less and configured wrappers against the same discovered
 *    inputs. External wrappers share one upfront namespace with no eligible
 *    ancestor lint config; cwd fallback and local wrapper precedence remain
 *    distinct from the main graph's ancestor configuration.
 *
 * @evidence contracts/testing.md#behavioral-verification The real launcher reports every independently authored contributor TODO/FIXME/XXX tuple, rejects leaked default marker options, renders the original no-var/prefer-const/TypeScript order and omits ignored generated inputs. The same typed check must return exactly2 with empty stdout and the authored structured Legacy restriction's exact custom message. A CJS warning-only command must return zero and empty stdout with exactly one no-console warn, while its actual normalized loader envelope retains both no-console:warning and no-debugger:error. The typed graph adds a real no-explicit-any diagnostic at authored mixed.ts line11 and verifies that same rule value in the typed evaluator envelope. The warning command additionally evaluates the pure CJS format-only child and its successful raw export must equal the single format/printWidth120 object. A namespace-spread helper supplies no-debugger:error, while the same root evaluator retains local ignores: main.ts line3 must report that rule and the included functional source must report nothing. Actual compiler API wrapper calls require cwd fallback with two discovery errors and wrapper precedence with only no-var.
 * @evidence contracts/testing.md#independent-expectations Original authored comment messages, option marker XXX versus TODO, source line numbers and literal rule/category tuples define expectations. The Legacy source and literal Use Safe instead. option independently require the exact no-restricted-types message, empty stdout and check status2; fixWith/suggest remain input fields, not claimed edit assertions. The authored main debugger and included functional debugger independently contrast active and locally ignored paths. The paired typed loader payload must retain the inherited no-debugger severity and the three literal ignore globs. The literal pure CJS printWidth120 object independently specifies the evaluator payload; TestFormatBlockPropagatesPrettierOptionsToRule owns the nonempty decoded width120 option. CLI stderr/parser and actual compile envelopes supply observations; discovery output never generates the expected rules.
 * @evidence contracts/testing.md#distinguishing-cases Typed package contributor/options, structured builtin rule options reaching the actual renderer, builtin-plus-TypeScript stream, globally ignored included dot/declaration files, explicit CJS warning normalization and its pure format-only extended export, namespace-default composition across an awaited factory return with inherited rules versus local ignores, config-less wrapper fallback and wrapper config precedence remain distinct.
 * @evidence contracts/testing.md#execution-ownership Selected esbuild calls this helper on one upfront lint island with workspace-linked owning lint/demo producers. Two real launcher commands and two actual synchronous compiler API preparations own all distinctions; source units are not treated as native registration/renderer evidence.
 * @evidence contracts/e2e.md#necessary-boundary Executable typed/CJS config evaluation, demo source discovery, serialized options, native rule diagnostic transport and CLI status must agree. Wrapper context must select its own config or actual cwd fallback; Go config/decoder units alone cannot establish that assembly.
 * @evidence contracts/e2e.md#shared-execution One source/config graph and the same owning source producer/cache serve both CLI modes and two wrapper contexts. Both wrappers reuse the independently prepared uninstalled namespace, outside the main graph's eligible ancestor config; its own include:[src] and root package remain unchanged. Different warning exit and wrapper origins require separate actual calls, not per-source fixtures or installations. Real native preparation/descriptor/Program totals remain unmeasured. Existing CLI count stays two. Relative to the old typed evaluation plus the donor's two evaluations, the candidate uses two typed evaluations; the warning command now pays a real typed evaluator and its required native preparation. Format defaults remain off in checks through expandFormatBlock, as independently owned by TestFormatBlockDefaultSeverityOffKeepsFormatRulesOutOfCheck. Internal Program/process totals and independent execution reduction remain unverified.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity CLI ordinary status and actual PID departure precede config mutation. The synchronous compile pipeline owns captures; an exception envelope retains the graph and blocks the next origin. Controlled original config bytes restore only while ownership remains resolved. Normal returns are not arbitrary descendant-release certificates. The helper mutation changes exactly one literal after the first CLI has closed. The typed entry bytes stay fixed, while the final owned restoration restores the helper before the pre-existing immutable-input comparison; unresolved child ownership still prevents restoration.
 * @evidence contracts/e2e.md#preserved-coverage Connects original three typed demo consumers, mixed rendered/parsed stream ordering, warning-only CJS severity/zero exit, config-less external-wrapper ignores and configured-wrapper precedence. TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig's actual typed evaluation, structured options, exact rule/custom message, empty stdout and status2 now execute on this existing typed-error result. The former basic CJS/TS loader donors now consume these same two real CLI/evaluator results; the untagged JSON normalization unit additionally owns no-console Warn/no-debugger Error vocabulary independently of module evaluation. Direct owning Go units retain pure severity/ignore/option normalization; no fixWith/suggest edit assertion or new CLI flag behavior is inferred. TestLoadRuleConfigTypeScriptConfigMergesSpreadDefaultWrapper now uses this same typed evaluator and Program; exact main debugger diagnostics and functional-path absence accompany raw inherited rule/local-ignore assertions. The owning ConfigStore unit preserves error/off resolution. TestLoadRuleConfigJavaScriptConfigFileRoundTripsFormatBlock now evaluates its pure CJS export as the warning module extends input, while TestFormatBlockPropagatesPrettierOptionsToRule retains the independently decoded width120 option. TestConfigDependencyGraphNeverPublishesTheFilesystemRoot now shares this warning evaluator: literal error/warning/warning module results and exact missing entry/watch versus owned directory/watch are checked on the same completed loader result, with no filesystem-root dependency and all watch directories physically within this config root. Authored transfer acceptance remains subject to execution. The async returned-default factory donor's real transport now accompanies these same two CLIs: logging dynamic import returns the namespace-spread helper with local ignores, then only that helper's debugger severity changes before the warning CLI evaluates the unchanged typed entry again. Both raw values retain semi:false and exact file/watch provenance. TestConfigStoreResolvesOptionsWithEntryScope and TestFormatBlockPropagatesPrettierOptionsToRule own pure error/off resolution and prefer-never decoding; the accepted loader provenance feeds appendConfigPaths, without certifying a public project-inputs reply. The tagged donor remains selected until this authored carrier receives actual validation.
 */
export function nativeLintConfigCorpus(
  workspace: BatchWorkspace.Workspace,
): void {
  const root = path.join(workspace.root, "tools/native-lint-config");
  const traceRoot =
    process.env.TTSC_E2E_TRACE ??
    TestProject.tmpdir("ttsc-lint-loader-observations-");
  assert.ok(path.isAbsolute(traceRoot));
  fs.mkdirSync(traceRoot, { recursive: true });
  const config = path.join(root, "tsconfig.json");
  const typed = path.join(root, "lint.config.ts");
  const originalConfig = fs.readFileSync(config);
  const originalTyped = fs.readFileSync(typed);
  const helper = path.join(root, "shared-lint.config.ts");
  const originalHelper = fs.readFileSync(helper);
  const immutableInputs = [
    "src/main.ts",
    "src/functional/api.ts",
    "shared-lint.config.ts",
    "src/options.ts",
    "src/diagnostic-stream.ts",
    "src/mixed.ts",
    "src/discovery.ts",
    "src/warning.ts",
    "next-env.d.ts",
    ".next/types/generated.ts",
    "base.config.json",
    "discovery.config.json",
    "warning.cjs",
    "format-only.cjs",
    "owned-root-boundary/target.cjs",
    "root-boundary-templates/root-boundary-absent-main/index.js",
    "root-boundary-templates/root-boundary-root-main/index.js",
  ].map(
    (name) =>
      [path.join(root, name), fs.readFileSync(path.join(root, name))] as const,
  );
  for (const name of [
    "fallback/tsconfig.json",
    "selected/tsconfig.json",
    "selected/lint.config.json",
  ]) {
    const file = path.join(workspace.lintWrapperRoot, name);
    immutableInputs.push([file, fs.readFileSync(file)]);
  }
  const failures: unknown[] = [];
  let unresolved = false;
  const capture = (name: string, body: () => void): void => {
    if (unresolved) {
      failures.push(
        new Error(name + ": preceding ownership remains unresolved"),
      );
      return;
    }
    try {
      body();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  const run = () => {
    const cursor = readE2eTraceMeasurements(traceRoot, []).lastWriterSequences;
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--noEmit"],
      {
        cwd: root,
        env: {
          TTSC_CACHE_DIR: workspace.cache,
          PATH: lintGoPath(),
          TTSC_E2E_TRACE: traceRoot,
        },
      },
    );
    if (!isOrdinarilyClosedReadonlyLauncher(result)) {
      unresolved = true;
      BatchWorkspace.retain("lint config launcher closure remained unresolved");
      throw new Error("lint config launcher closure remained unresolved", {
        cause: result.error,
      });
    }
    try {
      process.kill(result.pid, 0);
      unresolved = true;
      throw new Error("lint config launcher PID remained live");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        unresolved = true;
        BatchWorkspace.retain(
          "lint config launcher PID departure remained unresolved",
        );
        throw error;
      }
    }
    return {
      ...result,
      diagnostics: TestLint.parseDiagnostics(result.stderr),
      traces: readE2eTraceMeasurements(traceRoot, [], cursor),
    };
  };
  try {
    capture("typed contributor and mixed native stream", () => {
      const result = run();
      assert.equal(result.status, 2, result.stderr);
      assert.equal(result.stdout, "", result.stderr);
      const evaluated = assertExecutableConfigRules(
        result.traces,
        traceRoot,
        typed,
        {
          "typescript/no-explicit-any": "error",
          "no-debugger": "error",
        },
      );
      assert.deepEqual(evaluated.ignores, [
        ".next/**/*.ts",
        "next-env.d.ts",
        "src/functional/**/*.ts",
      ]);
      assert.deepEqual(evaluated.format, { semi: false });
      assertAsyncConfigWatchPaths(result.traces, typed, helper);
      assert.equal(
        result.diagnostics.some((row) =>
          row.file.replace(/\\/g, "/").includes("/src/functional/"),
        ),
        false,
        result.stderr,
      );
      assert.ok(
        result.stderr.includes("[typescript/no-restricted-types]"),
        result.stderr,
      );
      assert.ok(
        result.stderr.includes(
          "Don't use `Legacy` as a type. Use Safe instead.",
        ),
        result.stderr,
      );
      const demo = result.diagnostics
        .filter((row) => row.rule.startsWith("demo/"))
        .map(({ file, line, rule, severity, message }) => ({
          file: path.basename(file),
          line,
          rule,
          severity,
          message,
        }))
        .sort(
          (a, b) =>
            a.file.localeCompare(b.file) ||
            a.line - b.line ||
            a.rule.localeCompare(b.rule),
        );
      assert.deepEqual(
        demo,
        [
          {
            file: "diagnostic-stream.ts",
            line: 1,
            rule: "demo/no-todo-comment",
            severity: "error",
            message: "TODO comment is not allowed.",
          },
          {
            file: "diagnostic-stream.ts",
            line: 3,
            rule: "demo/no-todo-comment",
            severity: "error",
            message: "FIXME comment is not allowed.",
          },
          {
            file: "main.ts",
            line: 1,
            rule: "demo/no-todo-comment",
            severity: "error",
            message: "FIXME comment is not allowed.",
          },
          {
            file: "options.ts",
            line: 1,
            rule: "demo/no-marker-comment",
            severity: "error",
            message: "XXX marker is not allowed.",
          },
          {
            file: "options.ts",
            line: 3,
            rule: "demo/no-todo-comment",
            severity: "error",
            message: "TODO comment is not allowed.",
          },
        ],
        result.stderr,
      );
      assert.deepEqual(
        result.diagnostics
          .map(({ file, line, rule, severity }) => [
            path.basename(file),
            line,
            rule,
            severity,
          ])
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        [
          ["diagnostic-stream.ts", 1, "demo/no-todo-comment", "error"],
          ["diagnostic-stream.ts", 3, "demo/no-todo-comment", "error"],
          ["discovery.ts", 1, "no-var", "error"],
          ["discovery.ts", 2, "no-console", "error"],
          ["main.ts", 1, "demo/no-todo-comment", "error"],
          ["main.ts", 3, "no-debugger", "error"],
          ["mixed.ts", 1, "no-var", "error"],
          ["mixed.ts", 2, "prefer-const", "error"],
          ["mixed.ts", 8, "typescript/no-restricted-types", "error"],
          ["mixed.ts", 11, "typescript/no-explicit-any", "error"],
          ["options.ts", 1, "demo/no-marker-comment", "error"],
          ["options.ts", 3, "demo/no-todo-comment", "error"],
          ["warning.ts", 1, "no-console", "error"],
        ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        result.stderr,
      );
      assert.deepEqual(
        result.diagnostics
          .filter((row) => path.basename(row.file) === "mixed.ts")
          .map(({ rule, line }) => [rule, line]),
        [
          ["no-var", 1],
          ["prefer-const", 2],
          ["typescript/no-restricted-types", 8],
          ["typescript/no-explicit-any", 11],
        ],
        result.stderr,
      );
      assert.equal(
        result.diagnostics.some(
          (row) => row.file.includes(".next") || row.file.includes("next-env"),
        ),
        false,
        result.stderr,
      );
      const noVar = result.stderr.indexOf("[no-var]");
      const preferConst = result.stderr.indexOf("[prefer-const]");
      const typeError = result.stderr.indexOf(
        "Type 'string' is not assignable to type 'number'.",
      );
      assert.ok(
        noVar >= 0 && preferConst > noVar && typeError > preferConst,
        result.stderr,
      );
    });
    capture("CJS warning-only CLI", () => {
      assert.deepEqual(fs.readFileSync(typed), originalTyped);
      const helperText = originalHelper.toString("utf8");
      const errorRule = '"no-debugger": "error"';
      assert.equal(helperText.split(errorRule).length, 2);
      fs.writeFileSync(
        helper,
        helperText.replace(errorRule, '"no-debugger": "warning"'),
      );
      const project = JSON.parse(originalConfig.toString("utf8"));
      fs.writeFileSync(
        config,
        JSON.stringify({
          ...project,
          include: [],
          files: ["src/warning.ts"],
          compilerOptions: {
            ...project.compilerOptions,
            plugins: [{ transform: "@ttsc/lint", configFile: "./warning.cjs" }],
          },
        }),
      );
      const result = run();
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "", result.stderr);
      assertExecutableConfigRules(
        result.traces,
        traceRoot,
        path.join(root, "warning.cjs"),
        {
          "no-console": "warning",
          "no-debugger": "error",
          eqeqeq: "warning",
        },
      );
      const refreshed = assertExecutableConfigRules(
        result.traces,
        traceRoot,
        typed,
        { "no-debugger": "warning", "typescript/no-explicit-any": "error" },
      );
      assert.deepEqual(refreshed.format, { semi: false });
      assert.deepEqual(refreshed.ignores, [
        ".next/**/*.ts",
        "next-env.d.ts",
        "src/functional/**/*.ts",
      ]);
      assertAsyncConfigWatchPaths(result.traces, typed, helper);
      assert.deepEqual(fs.readFileSync(typed), originalTyped);
      assertRootBoundaryDependencies(result.traces, root);
      const formatOnly = assertExecutableConfigRules(
        result.traces,
        traceRoot,
        path.join(root, "format-only.cjs"),
        null,
      );
      assert.deepEqual(formatOnly, { format: { printWidth: 120 } });
      assert.deepEqual(
        result.diagnostics.map(({ rule, severity }) => [rule, severity]),
        [["no-console", "warn"]],
        result.stderr,
      );
    });
    if (!unresolved) {
      fs.writeFileSync(config, originalConfig);
      fs.unlinkSync(typed);
      fs.copyFileSync(
        path.join(root, "discovery.config.json"),
        path.join(root, "lint.config.json"),
      );
    }
    for (const mode of ["fallback", "selected"])
      capture("external wrapper " + mode, () => {
        const wrapper = path.join(workspace.lintWrapperRoot, mode);
        assert.equal(
          path.relative(root, wrapper).startsWith(".." + path.sep),
          true,
          wrapper,
        );
        const compiler = new TtscCompiler({
          cwd: root,
          projectRoot: root,
          tsconfig: path.join(wrapper, "tsconfig.json"),
          cacheDir: workspace.cache,
          env: {
            PATH: lintGoPath(),
            TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
            TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
            TTSC_GO_CACHE_DIR: TestProject.sharedGoBuildCache(),
          },
        });
        const result = compiler.compile();
        if (result.type === "exception") {
          unresolved = true;
          BatchWorkspace.retain(
            "lint wrapper native pipeline reported an exception",
          );
          throw new Error("lint wrapper native pipeline exception", {
            cause: result,
          });
        }
        assert.equal(result.type, "failure", JSON.stringify(result));
        if (result.type !== "failure")
          throw new Error("lint wrapper unexpectedly succeeded");
        assert.deepEqual(
          result.diagnostics
            .map((row) => [
              row.file === null ? null : path.basename(row.file),
              row.messageText.slice(0, row.messageText.indexOf("]") + 1),
              row.category,
            ])
            .sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
          mode === "fallback"
            ? [
                ["discovery.ts", "[no-console]", "error"],
                ["discovery.ts", "[no-var]", "error"],
              ]
            : [["discovery.ts", "[no-var]", "error"]],
          JSON.stringify(result.diagnostics),
        );
      });
  } catch (error) {
    failures.push(error);
  } finally {
    if (!unresolved) {
      for (const restore of [
        () => fs.writeFileSync(config, originalConfig),
        () => fs.writeFileSync(typed, originalTyped),
        () => fs.writeFileSync(helper, originalHelper),
        () => {
          const discovered = path.join(root, "lint.config.json");
          if (fs.existsSync(discovered)) fs.unlinkSync(discovered);
        },
      ]) {
        try {
          restore();
        } catch (error) {
          failures.push(error);
          BatchWorkspace.retain("lint config input restoration failed");
        }
      }
      for (const [file, bytes] of immutableInputs)
        try {
          assert.deepEqual(fs.readFileSync(file), bytes, file);
        } catch (error) {
          failures.push(error);
          BatchWorkspace.retain("lint config immutable input changed");
        }
      for (const [file, bytes] of [
        [config, originalConfig],
        [typed, originalTyped],
      ] as const)
        try {
          assert.deepEqual(fs.readFileSync(file), bytes, file);
        } catch (error) {
          failures.push(error);
          BatchWorkspace.retain(
            "lint config input restoration remained unverified",
          );
        }
    }
  }
  if (failures.length) {
    if (process.env.TTSC_E2E_TRACE === undefined) {
      try {
        TestProject.retainTemporaryDirectory(
          traceRoot,
          "Native lint loader assertions retain their actual raw evaluator observations",
        );
        console.error("Native lint loader observations retained: " + traceRoot);
      } catch (error) {
        failures.push(error);
      }
    }
    throw new AggregateError(failures, "native lint config boundaries failed");
  }
}

/**
 * Read the completed loader's captured bytes under its exact native writer and
 * invocation. This joins the evaluator result to its own child outcome and
 * successful dependency normalization; it does not infer values from sources or
 * run a second module evaluation. Rule-bearing exports require their literal
 * rules; a format-only export instead returns the same validated value for the
 * caller to compare as a complete object, without inventing a rules field.
 */
function assertExecutableConfigRules(
  traces: TraceMeasurements,
  traceRoot: string,
  location: string,
  rules: Readonly<Record<string, string>> | null,
): Record<string, unknown> {
  assert.deepEqual(traces.integrityProblems, []);
  const results = traces.writerObservations
    .map((row) => row.observation)
    .filter(
      (row) =>
        row.event === "config-loader-result" && row.data?.location === location,
    );
  assert.equal(results.length, 1, "one actual loader result for " + location);
  const [result] = results;
  assert.ok(result !== undefined);
  assert.equal(result.data?.readOutcome, "complete");
  assert.equal(result.data?.normalizationAttempted, true);
  assert.equal(result.data?.normalizationAccepted, true);
  assert.equal(typeof result.data?.dependenciesTracked, "boolean");
  assert.equal(result.data?.success, true);
  const invocation = traces.writerObservations
    .map((row) => row.observation)
    .filter(
      (row) =>
        row.writerPid === result.writerPid &&
        row.instance === result.instance &&
        row.invocation === result.invocation,
    );
  const attempts = invocation.filter((row) => row.event === "process-attempt");
  const terminals = invocation.filter((row) => row.event === "process-result");
  assert.equal(attempts.length, 1);
  assert.equal(terminals.length, 1);
  const [attempt] = attempts;
  const [terminal] = terminals;
  assert.ok(attempt !== undefined && terminal !== undefined);
  assert.ok(
    attempt.sequence < terminal.sequence && terminal.sequence < result.sequence,
  );
  assert.equal(terminal.data?.owner, "lint-config-loader");
  assert.ok(
    typeof terminal.pid === "number" &&
      Number.isSafeInteger(terminal.pid) &&
      terminal.pid > 0,
  );
  assert.equal(terminal.data?.started, true);
  assert.equal(terminal.data?.exitObserved, true);
  assert.equal(terminal.data?.exitCode, 0);
  assert.equal(terminal.data?.success, true);
  const captured = readE2eTracePayload(traceRoot, result, result.data?.raw);
  const envelope: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(captured.bytes),
  );
  assert.ok(envelope !== null && typeof envelope === "object");
  const value = (envelope as Record<string, unknown>).value;
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
  );
  if (rules !== null) {
    const actualRules = (value as Record<string, unknown>).rules;
    assert.ok(
      actualRules !== null &&
        typeof actualRules === "object" &&
        !Array.isArray(actualRules),
    );
    for (const [rule, severity] of Object.entries(rules))
      assert.equal(
        (actualRules as Record<string, unknown>)[rule],
        severity,
        location + ": " + rule,
      );
  }
  return value as Record<string, unknown>;
}

/**
 * The existing warning evaluator owns both missing-root topologies and the
 * ordinary owned-parent control. These literal coordinates are authored before
 * evaluation; normalized dependencies come from the same actual result whose
 * raw severity values and process completion were already checked.
 */
function assertRootBoundaryDependencies(
  traces: TraceMeasurements,
  root: string,
): void {
  const results = traces.writerObservations
    .map((row) => row.observation)
    .filter(
      (row) =>
        row.event === "config-loader-result" &&
        row.data?.location === path.join(root, "warning.cjs"),
    );
  assert.equal(results.length, 1);
  const [result] = results;
  assert.ok(result !== undefined);
  assert.equal(result.data?.dependenciesTracked, true);
  const dependencies: unknown = result.data?.dependencies;
  assert.ok(Array.isArray(dependencies));
  const filesystemRoot = path.parse(root).root;
  const expected = [
    [path.join(filesystemRoot, "ttsc-lint-absent-ancestor"), "entry"],
    [path.join(filesystemRoot, "ttsc-lint-absent-root-main.js"), "entry"],
    [path.join(root, "owned-root-boundary"), "directory"],
  ] as const;
  const matched = new Set<string>();
  const physicalRoot = fs.realpathSync.native(root);
  for (const input of dependencies) {
    const dependency: unknown = input;
    assert.ok(dependency !== null && typeof dependency === "object");
    assert.ok("path" in dependency && typeof dependency.path === "string");
    assert.ok("kind" in dependency && typeof dependency.kind === "string");
    assert.ok("scope" in dependency && typeof dependency.scope === "string");
    assert.notEqual(
      path.resolve(dependency.path),
      path.resolve(filesystemRoot),
    );
    for (const [location, kind] of expected)
      if (path.resolve(dependency.path) === path.resolve(location)) {
        assert.equal(dependency.kind, kind);
        assert.equal(dependency.scope, "watch");
        matched.add(location);
      }
    if (dependency.kind === "directory" && dependency.scope === "watch") {
      const relative = path.relative(
        physicalRoot,
        fs.realpathSync.native(dependency.path),
      );
      assert.equal(path.isAbsolute(relative), false);
      assert.equal(
        relative === ".." || relative.startsWith(".." + path.sep),
        false,
      );
    }
  }
  assert.deepEqual(
    [...matched].sort(),
    expected.map(([location]) => location).sort(),
  );
}

/**
 * Bind the two typed evaluations to their actual accepted entry/helper watch
 * inputs. These are the loader's normalized provenance consumed by
 * appendConfigPaths; no public project-inputs reply is inferred from it.
 *
 * @evidence contracts/testing.md#behavioral-verification Each completed typed loader result must track both the unchanged entry and imported helper as stable file/watch inputs with physical targets and SHA256 digests. This accompanies the same invocation's raw error or refreshed warning value, not an authored replacement payload.
 * @evidence contracts/testing.md#independent-expectations The named entry and helper are authored config inputs; file/watch scope, stable physical identity and nonempty digest follow their actual executable import relationship.
 * @evidence contracts/testing.md#distinguishing-cases Both first and helper-only-refreshed evaluations retain their two inputs. Missing tracking, a dropped helper, cache-only scope or unstable file identity fails independently of a correct rule value.
 * @evidence contracts/testing.md#execution-ownership nativeLintConfigCorpus calls this assertion on the existing typed CLI and warning CLI trace windows. The prior raw-payload assertion already joins these events to the actual loader process and terminal; this helper adds no evaluation or child.
 * @evidence contracts/e2e.md#necessary-boundary Actual Node/typed evaluator imports must publish accepted provenance to the Go config loader; a manually parsed object or callback cannot prove that the helper remains a watch dependency after the async return.
 * @evidence contracts/e2e.md#shared-execution The two existing CLI result windows supply both evaluations; this assertion reads their captured metadata and checks the already authored paths rather than starting a loader or separate project.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each caller supplies only its completed invocation window. Physical targets are checked against the same owned fixture, and restoration remains with nativeLintConfigCorpus after both commands.
 * @evidence contracts/e2e.md#preserved-coverage Preserves entry/helper transport from the async donor; internal ConfigStore path copying and rule-option resolution remain unit responsibilities. This accepted dependency envelope is not certified as a public LSP project-inputs result.
 */
function assertAsyncConfigWatchPaths(
  traces: TraceMeasurements,
  entry: string,
  helper: string,
): void {
  const results = traces.writerObservations
    .map((row) => row.observation)
    .filter(
      (row) =>
        row.event === "config-loader-result" && row.data?.location === entry,
    );
  assert.equal(results.length, 1);
  const [result] = results;
  assert.ok(result !== undefined);
  assert.equal(result.data?.dependenciesTracked, true);
  const dependencies: unknown = result.data?.dependencies;
  assert.ok(Array.isArray(dependencies));
  for (const expected of [entry, helper]) {
    const matches: unknown[] = dependencies.filter(
      (dependency: unknown) =>
        dependency !== null &&
        typeof dependency === "object" &&
        "path" in dependency &&
        typeof dependency.path === "string" &&
        path.resolve(dependency.path) === path.resolve(expected),
    );
    assert.equal(matches.length, 1, expected);
    const [dependency]: unknown[] = matches;
    assert.ok(dependency !== null && typeof dependency === "object");
    assert.ok("kind" in dependency && dependency.kind === "file");
    assert.ok("scope" in dependency && dependency.scope === "watch");
    assert.ok(
      "identityStable" in dependency && dependency.identityStable === true,
    );
    assert.ok(
      "realpath" in dependency && typeof dependency.realpath === "string",
    );
    assert.equal(dependency.realpath, fs.realpathSync.native(expected));
    assert.ok("digest" in dependency && typeof dependency.digest === "string");
    assert.match(dependency.digest, /^[a-f0-9]{64}$/);
  }
}

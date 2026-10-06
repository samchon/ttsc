import { TestLint, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../packages/ttsc/lib/index.js";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { lintGoPath } from "../internal/lint/internal/config-file";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies typed contributor/config discovery and native CLI diagnostic transport.
 *
 * 1. Run one typed-config graph containing all original contributor and mixed stream inputs.
 * 2. Contrast one CJS warning-only command with the error graph's native stream.
 * 3. Compile config-less and configured wrappers against the same discovered inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification The real launcher reports every independently authored contributor TODO/FIXME/XXX tuple, rejects leaked default marker options, renders the original no-var/prefer-const/TypeScript order and omits ignored generated inputs. A CJS warning-only command must return zero with exactly one no-console warn. Actual compiler API wrapper calls require cwd fallback with two discovery errors and wrapper precedence with only no-var.
 * @evidence contracts/testing.md#independent-expectations Original authored comment messages, option marker XXX versus TODO, source line numbers and literal rule/category tuples define expectations. CLI stderr/parser and actual compile envelopes supply observations; discovery output never generates the expected rules.
 * @evidence contracts/testing.md#distinguishing-cases Typed package contributor/options, builtin-plus-TypeScript stream, globally ignored included dot/declaration files, explicit CJS warning normalization, config-less wrapper fallback and wrapper config precedence remain distinct.
 * @evidence contracts/testing.md#execution-ownership Selected esbuild calls this helper on one upfront lint island with workspace-linked owning lint/demo producers. Two real launcher commands and two actual synchronous compiler API preparations own all distinctions; source units are not treated as native registration/renderer evidence.
 * @evidence contracts/e2e.md#necessary-boundary Executable typed/CJS config evaluation, demo source discovery, serialized options, native rule diagnostic transport and CLI status must agree. Wrapper context must select its own config or actual cwd fallback; Go config/decoder units alone cannot establish that assembly.
 * @evidence contracts/e2e.md#shared-execution One source/config graph and the same owning source producer/cache serve both CLI modes and two wrapper contexts. Different warning exit and wrapper origins require separate actual calls, not per-source fixtures or installations. Real native preparation/descriptor/Program totals remain unmeasured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity CLI ordinary status and actual PID departure precede config mutation. The synchronous compile pipeline owns captures; an exception envelope retains the graph and blocks the next origin. Controlled original config bytes restore only while ownership remains resolved. Normal returns are not arbitrary descendant-release certificates.
 * @evidence contracts/e2e.md#preserved-coverage Connects original three typed demo consumers, mixed rendered/parsed stream ordering, warning-only CJS severity/zero exit, config-less external-wrapper ignores and configured-wrapper precedence. Direct owning Go units retain pure severity/ignore/option normalization; no new undefined-export or CLI flag behavior is inferred. Written native connections remain unexecuted until CI.
 */
export function nativeLintConfigCorpus(workspace: BatchWorkspace.Workspace): void {
  const root = path.join(workspace.root, "tools/native-lint-config");
  const config = path.join(root, "tsconfig.json");
  const typed = path.join(root, "lint.config.ts");
  const originalConfig = fs.readFileSync(config);
  const originalTyped = fs.readFileSync(typed);
  const immutableInputs = ["src/main.ts", "src/options.ts", "src/diagnostic-stream.ts", "src/mixed.ts", "src/discovery.ts", "src/warning.ts", "next-env.d.ts", ".next/types/generated.ts", "base.config.json", "discovery.config.json", "warning.cjs", "../native-lint-wrappers/fallback/tsconfig.json", "../native-lint-wrappers/selected/tsconfig.json", "../native-lint-wrappers/selected/lint.config.json"].map((name) => [path.join(root, name), fs.readFileSync(path.join(root, name))] as const);
  const failures: unknown[] = [];
  let unresolved = false;
  const capture = (name: string, body: () => void): void => {
    if (unresolved) { failures.push(new Error(name + ": preceding ownership remains unresolved")); return; }
    try { body(); } catch (error) { failures.push(new Error(name, { cause: error })); }
  };
  const run = () => {
    const result = TestProject.spawn(TestProject.TTSC_BIN, ["--cwd", root, "--noEmit"], { cwd: root, env: { TTSC_CACHE_DIR: workspace.cache, PATH: lintGoPath() } });
    if (!isOrdinarilyClosedReadonlyLauncher(result)) { unresolved = true; BatchWorkspace.retain("lint config launcher closure remained unresolved"); throw new Error("lint config launcher closure remained unresolved", { cause: result.error }); }
    try { process.kill(result.pid, 0); unresolved = true; throw new Error("lint config launcher PID remained live"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") { unresolved = true; BatchWorkspace.retain("lint config launcher PID departure remained unresolved"); throw error; } }
    return { ...result, diagnostics: TestLint.parseDiagnostics(result.stderr) };
  };
  try {
    capture("typed contributor and mixed native stream", () => {
      const result = run();
      assert.notEqual(result.status, 0, result.stderr);
      const demo = result.diagnostics.filter((row) => row.rule.startsWith("demo/")).map(({ file, line, rule, severity, message }) => ({ file: path.basename(file), line, rule, severity, message })).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
      assert.deepEqual(demo, [
        { file: "diagnostic-stream.ts", line: 1, rule: "demo/no-todo-comment", severity: "error", message: "TODO comment is not allowed." },
        { file: "diagnostic-stream.ts", line: 3, rule: "demo/no-todo-comment", severity: "error", message: "FIXME comment is not allowed." },
        { file: "main.ts", line: 1, rule: "demo/no-todo-comment", severity: "error", message: "FIXME comment is not allowed." },
        { file: "options.ts", line: 1, rule: "demo/no-marker-comment", severity: "error", message: "XXX marker is not allowed." },
        { file: "options.ts", line: 3, rule: "demo/no-todo-comment", severity: "error", message: "TODO comment is not allowed." },
      ], result.stderr);
      assert.deepEqual(result.diagnostics.map(({ file, line, rule, severity }) => [path.basename(file), line, rule, severity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [
        ["diagnostic-stream.ts", 1, "demo/no-todo-comment", "error"],
        ["diagnostic-stream.ts", 3, "demo/no-todo-comment", "error"],
        ["discovery.ts", 1, "no-var", "error"],
        ["discovery.ts", 2, "no-console", "error"],
        ["main.ts", 1, "demo/no-todo-comment", "error"],
        ["mixed.ts", 1, "no-var", "error"],
        ["mixed.ts", 2, "prefer-const", "error"],
        ["options.ts", 1, "demo/no-marker-comment", "error"],
        ["options.ts", 3, "demo/no-todo-comment", "error"],
        ["warning.ts", 1, "no-console", "error"],
      ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), result.stderr);
      assert.deepEqual(result.diagnostics.filter((row) => path.basename(row.file) === "mixed.ts").map(({ rule, line }) => [rule, line]), [["no-var", 1], ["prefer-const", 2]], result.stderr);
      assert.equal(result.diagnostics.some((row) => row.file.includes(".next") || row.file.includes("next-env")), false, result.stderr);
      const noVar = result.stderr.indexOf("[no-var]");
      const preferConst = result.stderr.indexOf("[prefer-const]");
      const typeError = result.stderr.indexOf("Type 'string' is not assignable to type 'number'.");
      assert.ok(noVar >= 0 && preferConst > noVar && typeError > preferConst, result.stderr);
    });
    capture("CJS warning-only CLI", () => {
      const project = JSON.parse(originalConfig.toString("utf8"));
      fs.writeFileSync(config, JSON.stringify({ ...project, include: [], files: ["src/warning.ts"], compilerOptions: { ...project.compilerOptions, plugins: [{ transform: "@ttsc/lint", configFile: "./warning.cjs" }] } }));
      const result = run();
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.diagnostics.map(({ rule, severity }) => [rule, severity]), [["no-console", "warn"]], result.stderr);
    });
    if (!unresolved) {
      fs.writeFileSync(config, originalConfig);
      fs.unlinkSync(typed);
      fs.copyFileSync(path.join(root, "discovery.config.json"), path.join(root, "lint.config.json"));
    }
    for (const mode of ["fallback", "selected"])
      capture("external wrapper " + mode, () => {
        const wrapper = path.join(workspace.root, "tools/native-lint-wrappers", mode);
        assert.equal(path.relative(root, wrapper).startsWith(".." + path.sep), true, wrapper);
        const compiler = new TtscCompiler({ cwd: root, projectRoot: root, tsconfig: path.join(wrapper, "tsconfig.json"), cacheDir: workspace.cache, env: { PATH: lintGoPath(), TTSC_TSGO_BINARY: TestProject.TSGO_BINARY, TTSC_TTSX_BINARY: TestProject.TTSX_BIN, TTSC_GO_CACHE_DIR: TestProject.sharedGoBuildCache() } });
        const result = compiler.compile();
        if (result.type === "exception") { unresolved = true; BatchWorkspace.retain("lint wrapper native pipeline reported an exception"); throw new Error("lint wrapper native pipeline exception", { cause: result }); }
        assert.equal(result.type, "failure", JSON.stringify(result));
        if (result.type !== "failure") throw new Error("lint wrapper unexpectedly succeeded");
        assert.deepEqual(result.diagnostics.map((row) => [row.file === null ? null : path.basename(row.file), row.messageText.slice(0, row.messageText.indexOf("]") + 1), row.category]).sort((a, b) => String(a[1]).localeCompare(String(b[1]))), mode === "fallback" ? [["discovery.ts", "[no-console]", "error"], ["discovery.ts", "[no-var]", "error"]] : [["discovery.ts", "[no-var]", "error"]], JSON.stringify(result.diagnostics));
      });
  } catch (error) {
    failures.push(error);
  } finally {
    if (!unresolved) {
      for (const restore of [
        () => fs.writeFileSync(config, originalConfig),
        () => fs.writeFileSync(typed, originalTyped),
        () => { const discovered = path.join(root, "lint.config.json"); if (fs.existsSync(discovered)) fs.unlinkSync(discovered); },
      ]) {
        try { restore(); } catch (error) { failures.push(error); BatchWorkspace.retain("lint config input restoration failed"); }
      }
      for (const [file, bytes] of immutableInputs)
        try { assert.deepEqual(fs.readFileSync(file), bytes, file); } catch (error) { failures.push(error); BatchWorkspace.retain("lint config immutable input changed"); }
      for (const [file, bytes] of [[config, originalConfig], [typed, originalTyped]] as const)
        try { assert.deepEqual(fs.readFileSync(file), bytes, file); } catch (error) { failures.push(error); BatchWorkspace.retain("lint config input restoration remained unverified"); }
    }
  }
  if (failures.length) throw new AggregateError(failures, "native lint config boundaries failed");
}

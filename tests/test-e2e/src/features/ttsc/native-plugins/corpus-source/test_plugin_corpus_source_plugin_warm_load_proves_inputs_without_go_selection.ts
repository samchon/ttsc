import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  copyDirectory,
  copyProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { TestProject } from "@ttsc/testing";

/**
 * Verifies the warm-load budget of a cached nested source plugin: an unchanged
 * launch proves its inputs from the plugin cache's records and runs no Go
 * package selection, no source copy and no runtime re-probe.
 *
 * WARNING (#1721, #1722, #1723): this is the regression guard for a class that
 * was fixed and then regressed across patches. A warm typia launch once took
 * 27 s on Windows while the native build took 0.28 s, because every process
 * re-ran `go list` twice, copied the plugin module twice and re-read the plugin
 * sources, the ttsc overlay, the whole GOROOT and the Node executable. Each
 * earlier fix only memoized inside one process, and a launch is one process.
 * If this case fails, a launch is paying for unchanged inputs again.
 *
 * 1. Copy the project and a nested Go transformer module into it, settle the
 *    sources' stamps, and build cold.
 * 2. Build again under a private `TTSC_E2E_TRACE` and assert the budget: no
 *    `go list`, no `go work`, no runtime probe or executable streaming, the
 *    package selection answered from its record, and every content identity
 *    reused.
 * 3. Edit the transformer's Go source and build again: the binary is rebuilt
 *    and Go selection observes the edited module.
 *
 * @evidence contracts/testing.md#behavioral-verification Real `ttsc` builds run cold, warm and after an edit; the warm trace's process attempts and identity/answer observations are the asserted behavior, alongside build status, the cold-build log and the rebuilt binary after the edit.
 * @evidence contracts/testing.md#independent-expectations The budget follows from the contract that unchanged inputs are proven from records: Go selection and runtime probing are absent by construction, and every identity outcome must be "reused". The edit's expectation, a rebuild with a fresh `go list`, follows from content keying.
 * @evidence contracts/testing.md#distinguishing-cases Owns the unchanged warm launch (no selection, no probe, all reused) against the edited launch (rebuild and fresh selection). Unit cases own the per-input invalidation matrix of each record family.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-source export in the generic E2E population; its body owns the three CLI launches and reads the trace it requested.
 * @evidence contracts/e2e.md#necessary-boundary Cross-process reuse exists only between real launches: a unit cannot show that a new process reads no bytes and starts no Go selection.
 * @evidence contracts/e2e.md#shared-execution The suite Go object cache is shared; the plugin cache, identities and answers start absent in this private project so the cold launch records exactly what the warm one reuses.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project, the copied transformer module and the private trace directory belong to this case; NODE_OPTIONS is emptied so runtime records are eligible; sources are settled to a past stamp so the separable-stamp rule can hold. Each launch finishes before the next starts.
 * @evidence contracts/e2e.md#preserved-coverage New coverage; no existing assertion moved here.
 */
export function test_plugin_corpus_source_plugin_warm_load_proves_inputs_without_go_selection(): void {
  const root = copyProject("go-source-plugin");
  const transformer = path.join(root, "go-transformer");
  copyDirectory(
    path.join(workspaceRoot, "packages", "ttsc", "test", "go-transformer"),
    transformer,
  );
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `const path = require("node:path");
module.exports = (context) => ({
  name: "go-source-plugin",
  source: path.resolve(context.dirname, "go-transformer", "cmd", "ttsc-go-transformer"),
  hostInputHashes: {},
});
`,
  );
  fs.mkdirSync(path.join(root, "node_modules"));
  const past = new Date(Date.now() - 3_600_000);
  const settle = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) settle(location);
      else fs.utimesSync(location, past, past);
    }
  };
  settle(transformer);
  const env = {
    PATH: goPath(),
    NODE_OPTIONS: "",
    TTSC_CACHE_DIR: "",
    TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
  };
  const sink = process.env.TTSC_E2E_TRACE;
  const build = (trace?: string) => {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: trace === undefined ? env : { ...env, TTSC_E2E_TRACE: trace },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    return result;
  };
  const traced = (label: string) => {
    const trace = TestProject.tmpdir(
      `ttsc-warm-load-${label}-`,
      sink !== undefined && path.isAbsolute(sink) ? sink : undefined,
    );
    const result = build(trace);
    return { result, events: readTrace(trace) };
  };

  const cold = build();
  assert.match(cold.stderr, /building source plugin "go-source-plugin"/);

  const warm = traced("warm");
  assert.doesNotMatch(warm.result.stderr, /building source plugin/);
  const goCommands = warm.events
    .filter((event) => event.event === "process-attempt")
    .map((event) => event.argv ?? [])
    .filter((argv) => /^go(\.exe)?$/i.test(path.basename(argv[0] ?? "")))
    .map((argv) => argv[1]);
  assert.equal(
    goCommands.includes("list"),
    false,
    "a warm load must not run go list",
  );
  assert.equal(
    goCommands.includes("work"),
    false,
    "a warm load must not write a Go workspace",
  );
  const phases = warm.events
    .filter((event) => event.event === "capability-resolution")
    .map((event) => event.data ?? {});
  assert.equal(
    warm.events.some(
      (event) =>
        event.event === "process-attempt" &&
        event.data?.origin === "runtime-capability-probe",
    ),
    false,
    "a warm load must not re-probe its runtime",
  );
  assert.equal(
    phases.some((data) => data.phase === "runtime-executable-identity-observed"),
    false,
    "a warm load must not stream its runtime executable",
  );
  const identities = phases.filter(
    (data) => data.phase === "plugin-content-identity",
  );
  assert.ok(
    identities.some((data) => data.kind === "goroot"),
    "the GOROOT identity is proven",
  );
  assert.ok(
    identities.some((data) => data.kind === "plugin-source"),
    "the plugin source identity is proven",
  );
  assert.deepEqual(
    identities
      .filter((data) => data.outcome !== "reused")
      .map((data) => `${data.kind} ${data.outcome} ${data.subject}`),
    [],
    "every content identity of an unchanged launch is reused",
  );
  assert.ok(
    phases.some(
      (data) =>
        data.phase === "plugin-load-answer" &&
        data.kind === "go-package-selection" &&
        data.outcome === "reused",
    ),
    "the package selection is answered from its record",
  );

  const source = path.join(transformer, "transformer", "transformer.go");
  fs.appendFileSync(source, "\n// edited after the warm launch\n");
  const edited = traced("edited");
  assert.match(edited.result.stderr, /building source plugin "go-source-plugin"/);
  assert.ok(
    edited.events.some(
      (event) =>
        event.event === "process-attempt" &&
        /^go(\.exe)?$/i.test(path.basename(event.argv?.[0] ?? "")) &&
        event.argv?.[1] === "list",
    ),
    "an edited module is selected by Go again",
  );
}

interface ITraceEvent {
  event: string;
  argv?: string[];
  data?: Record<string, unknown>;
}

function readTrace(directory: string): ITraceEvent[] {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(directory, name), "utf8")
        .split("\n")
        .filter((line) => line.length !== 0)
        .map((line) => JSON.parse(line) as ITraceEvent),
    );
}

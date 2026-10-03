import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/**
 * The edits a host must see across a restart over its persistent cache: the
 * host stops, the project changes while nothing is running, and the host starts
 * again over the cache its last session stored.
 *
 * A host with a persistent cache serves a module from it when the module's
 * recorded inputs are unchanged. What the adapter registered as the module's
 * inputs is therefore what the host validates, and an input it never heard of
 * lets a stale output through: only the compiler's verdict on the current state
 * may be served. Two unchanged adoptions distinguish persisted reuse from
 * rebuilding; the final stopped edit must invalidate that stored generation.
 *
 * Each session runs in a process of its own (`restart-cycle.mjs`), the way a
 * restarted host does, over the host's persistent cache, and proves that cache
 * stored before the next starts, so a step never passes by rebuilding from
 * nothing. A restart over an unchanged project expects no compile at all: a
 * cache the adapter's registrations invalidate on every restart is correct and
 * useless. It is repeated, so a cache that serves once and then loses an input
 * to the session between, a record the next session moved, is told apart from
 * one that serves.
 *
 * A step is `{ name, edit, expect }`: `edit` changes the project while nothing
 * runs, and `expect` is what the next session must observe, `{ kind: "settled",
 * value }` or `{ kind: "failed", pattern }`, with `compiles` the most compiles
 * it may run, `0` for a restart over an unchanged project, and `live` a value
 * the tsconfig is then edited to while that session runs, which it must serve
 * and then serve the step's value again once the tsconfig is restored. A
 * session served whole from the cache ran the adapter for no module, so nothing
 * of the project was registered in it by a delivery: an edit to an input no
 * bundler loads, the tsconfig, is heard only by what the build start handed the
 * session's own observer.
 *
 * Turbopack re-runs every webpack loader that starts a child process on every
 * start, whatever its dependencies: measured on Next 16.3 with a loader that
 * only counts its runs, which Turbopack restores from its cache across
 * restarts, and runs again on every start once it calls `execFile` or
 * `spawnSync`, while a worker thread or a 300 ms busy wait keeps it cached.
 * ttsc's loader starts the native compiler, so under Turbopack an unchanged
 * restart runs every module again, in fresh workers. The session's store
 * outlives the process, so those workers adopt what the last session compiled
 * after proving it, and an unchanged restart compiles nothing there either
 * (samchon/ttsc#1483).
 */
export const RESTART_STEPS = [
  {
    name: "restart without edits",
    edit: () => undefined,
    expect: { kind: "settled", value: "FIRST", compiles: 0 },
  },
  {
    name: "second restart without edits",
    edit: () => undefined,
    expect: {
      kind: "settled",
      value: "FIRST",
      compiles: 0,
      live: "CONFIGURED",
    },
  },
  {
    name: "input edited while stopped",
    edit: (project) => project.change("SECOND"),
    expect: { kind: "settled", value: "SECOND" },
  },
  {
    name: "restart without edits after offline invalidation",
    edit: () => undefined,
    expect: { kind: "settled", value: "SECOND", compiles: 0 },
  },
];

/**
 * Run every restart step on one project: a session over the host's persistent
 * cache in a process of its own, stopped, the edit, and the next. A session
 * followed by a step that must be served from the cache waits for its store
 * before it stops, and so does every session of a host that cannot open a store
 * cut short, for the stores it writes (`restart-cycle.mjs`).
 *
 * @param project The fixture, on its first value.
 * @param host The host, one `restart-cycle.mjs` knows.
 */
export async function restartContract(project, host) {
  // Every backend consumes one project-record signal; it does not interpret
  // the config, declaration or membership proofs stored in that record.
  // test_project_record_proofs_cover_offline_restart_edits owns those input
  // distinctions directly, including restoration, missing inputs and exclusions.
  // The live SCENARIOS still verify their native compiler verdicts and watcher
  // registration. Here each backend owns persistence, repeated unchanged
  // adoption, live observation after cached adoption and an offline invalidation.
  // Webpack also proves that the newly compiled offline generation, not just
  // the original one, can be restored unchanged. Other backends retain their
  // existing four-lifetime boundary; input-kind variants stay in the proof unit.
  const steps = host === "webpack" ? RESTART_STEPS : RESTART_STEPS.slice(0, 3);
  const cycle = (label, expectation) =>
    restartCycle(project, host, label, expectation);
  const expectation = (index) => {
    const step = steps[index];
    const next = steps[index + 1];
    const store = next?.expect.compiles !== undefined;
    if (step === undefined) {
      return { kind: "settled", value: "FIRST", store };
    }
    return { ...step.expect, store };
  };
  await cycle("first session", expectation(-1));
  for (const [index, step] of steps.entries()) {
    step.edit(project);
    await cycle(step.name, expectation(index));
  }
}

/**
 * One session of the restart contract, in a process of its own
 * (`restart-cycle.mjs`), over the host's persistent cache and run in the
 * project's root, which is the host's root.
 *
 * @param project The fixture.
 * @param host The host, one `restart-cycle.mjs` knows.
 * @param label The step, for a failure to name.
 * @param expectation What the session must observe (`restart-cycle.mjs`).
 */
export async function restartCycle(project, host, label, expectation) {
  try {
    await promisify(execFile)(
      process.execPath,
      [
        fileURLToPath(new URL("./restart-cycle.mjs", import.meta.url)),
        host,
        project.root,
        project.plugin,
        JSON.stringify({ ...expectation, label }),
      ],
      {
        cwd: project.root,
        env: process.env,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 300_000,
        windowsHide: true,
      },
    );
  } catch (error) {
    throw new Error(
      `${host}: ${label}: ${error.stderr ?? ""}${error.stdout ?? ""}${error.message}`,
      { cause: error },
    );
  }
}

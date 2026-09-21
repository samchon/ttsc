import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { write } from "./common.mjs";

/**
 * The edits a host must see across a restart over its persistent cache: the
 * host stops, the project changes while nothing is running, and the host starts
 * again over the cache its last session stored.
 *
 * A host with a persistent cache serves a module from it when the module's
 * recorded inputs are unchanged. What the adapter registered as the module's
 * inputs is therefore what the host validates, and an input it never heard of
 * lets a stale output through: only the compiler's verdict on the current state
 * may be served. Every step below changes the compiler's verdict while the host
 * is stopped, then starts the host and reads what it serves.
 *
 * Each session runs in a process of its own (`restart-cycle.mjs`), the way a
 * restarted host does, over the host's persistent cache, and proves that cache
 * stored before the next starts, so a step never passes by rebuilding from
 * nothing. A restart over an unchanged project expects no compile at all: a
 * cache the adapter's registrations invalidate on every restart is correct and
 * useless. It is repeated, so a cache that serves once and then loses an input
 * to the session between, a sentinel the next session swept, is told apart from
 * one that serves.
 *
 * A step is `{ name, edit, expect }`: `edit` changes the project while nothing
 * runs, and `expect` is what the next session must observe, `{ kind: "settled",
 * value }` or `{ kind: "failed", pattern }`, with `compiles` the most compiles
 * it may run, `0` for a restart over an unchanged project.
 *
 * Turbopack re-runs every webpack loader that starts a child process on every
 * start, whatever its dependencies: measured on Next 16.3 with a loader that
 * only counts its runs, which Turbopack restores from its cache across
 * restarts, and runs again on every start once it calls `execFile` or
 * `spawnSync`, while a worker thread or a 300 ms busy wait keeps it cached.
 * ttsc's loader starts the native compiler, so under Turbopack an unchanged
 * restart runs every module again, which shares one compile through the
 * session, and the step allows that one compile.
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
    expect: { kind: "settled", value: "FIRST", compiles: 0 },
  },
  {
    name: "input edited while stopped",
    edit: (project) => project.change("SECOND"),
    expect: { kind: "settled", value: "SECOND" },
  },
  {
    name: "tsconfig edited while stopped",
    edit: (project) => project.configure("CONFIGURED"),
    expect: { kind: "settled", value: "CONFIGURED" },
  },
  {
    name: "tsconfig restored while stopped",
    edit: (project) => project.configure(undefined),
    expect: { kind: "settled", value: "SECOND" },
  },
  {
    name: "restart without edits after edits",
    edit: () => undefined,
    expect: { kind: "settled", value: "SECOND", compiles: 0 },
  },
  {
    name: "root file added while stopped",
    // A declaration the tsconfig includes appears; it is broken, so the
    // compiler's verdict on every module changes, and no module the host
    // loaded changed.
    edit: (project) =>
      write(project.root, "src/broken.d.ts", "export type Broken = ;\n"),
    expect: { kind: "failed", pattern: "Type expected" },
  },
  {
    name: "root file removed while stopped",
    edit: (project) =>
      fs.rmSync(path.join(project.root, "src", "broken.d.ts"), { force: true }),
    expect: { kind: "settled", value: "SECOND" },
  },
  {
    name: "new dependency while stopped",
    edit: (project) => {
      project.sibling("late", "THIRD");
      project.change("FROM_LATE");
    },
    expect: { kind: "settled", value: "THIRD" },
  },
  {
    name: "dependency renamed away while stopped",
    edit: (project) =>
      fs.renameSync(
        project.siblingPath("late"),
        `${project.siblingPath("late")}.moved`,
      ),
    expect: { kind: "failed", pattern: "late-input|ENOENT|not found" },
  },
  {
    name: "dependency renamed back while stopped",
    edit: (project) =>
      fs.renameSync(
        `${project.siblingPath("late")}.moved`,
        project.siblingPath("late"),
      ),
    expect: { kind: "settled", value: "THIRD" },
  },
  {
    name: "external input broken while stopped",
    edit: (project) => project.shape("broken"),
    expect: { kind: "failed", pattern: "not assignable" },
  },
  {
    name: "external input repaired while stopped",
    edit: (project) => project.shape("ok"),
    expect: { kind: "settled", value: "THIRD" },
  },
];

/** Hosts that re-run a loader starting a child process on every start. */
const SESSION_DEPENDENT_LOADERS = new Set(["next-turbopack"]);

/**
 * Run every restart step on one project: a session over the host's persistent
 * cache in a process of its own, stopped, the edit, and the next. A session
 * followed by a step that must be served from the cache waits for its store
 * before it stops.
 *
 * @param project The fixture, on its first value.
 * @param host The host, one `restart-cycle.mjs` knows.
 */
export async function restartContract(project, host) {
  const cycle = async (label, expectation) => {
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
  };
  const expectation = (index) => {
    const step = RESTART_STEPS[index];
    const next = RESTART_STEPS[index + 1];
    const store = next?.expect.compiles !== undefined;
    if (step === undefined) {
      return { kind: "settled", value: "FIRST", store };
    }
    const compiles =
      step.expect.compiles === undefined
        ? undefined
        : SESSION_DEPENDENT_LOADERS.has(host)
          ? 1
          : step.expect.compiles;
    return {
      ...step.expect,
      ...(compiles === undefined ? {} : { compiles }),
      store,
    };
  };
  await cycle("first session", expectation(-1));
  for (const [index, step] of RESTART_STEPS.entries()) {
    step.edit(project);
    await cycle(step.name, expectation(index));
  }
}

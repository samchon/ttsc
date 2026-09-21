import fs from "node:fs";
import path from "node:path";

import { eventually, write } from "./common.mjs";

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
 * A session is opened with the host's persistent cache on, through
 * `open(project)`, and reports `stored()` once its cache is on disk, so a step
 * proves the cache was there to be reused before the restart, not merely that
 * the host rebuilt from nothing.
 */
export const RESTART_STEPS = [
  {
    name: "input edited while stopped",
    edit: (project) => project.change("SECOND"),
    expect: (session) =>
      session.settled("input edited while stopped", "SECOND", []),
  },
  {
    name: "tsconfig edited while stopped",
    edit: (project) => project.configure("CONFIGURED"),
    expect: (session) =>
      session.settled("tsconfig edited while stopped", "CONFIGURED", []),
  },
  {
    name: "tsconfig restored while stopped",
    edit: (project) => project.configure(undefined),
    expect: (session) =>
      session.settled("tsconfig restored while stopped", "SECOND", []),
  },
  {
    name: "root file added while stopped",
    // A declaration the tsconfig includes appears; it is broken, so the
    // compiler's verdict on every module changes, and no module the host
    // loaded changed.
    edit: (project) =>
      write(project.root, "src/broken.d.ts", "export type Broken = ;\n"),
    expect: (session) =>
      session.failed("root file added while stopped", /Type expected/),
  },
  {
    name: "root file removed while stopped",
    edit: (project) =>
      fs.rmSync(path.join(project.root, "src", "broken.d.ts"), { force: true }),
    expect: (session) =>
      session.settled("root file removed while stopped", "SECOND", []),
  },
  {
    name: "new dependency while stopped",
    edit: (project) => {
      project.sibling("late", "THIRD");
      project.change("FROM_LATE");
    },
    expect: (session) =>
      session.settled("new dependency while stopped", "THIRD", []),
  },
  {
    name: "dependency renamed away while stopped",
    edit: (project) =>
      fs.renameSync(
        project.siblingPath("late"),
        `${project.siblingPath("late")}.moved`,
      ),
    expect: (session) =>
      session.failed(
        "dependency renamed away while stopped",
        /late-input|ENOENT|not found/i,
      ),
  },
  {
    name: "dependency renamed back while stopped",
    edit: (project) =>
      fs.renameSync(
        `${project.siblingPath("late")}.moved`,
        project.siblingPath("late"),
      ),
    expect: (session) =>
      session.settled("dependency renamed back while stopped", "THIRD", []),
  },
  {
    name: "external input broken while stopped",
    edit: (project) => project.shape("broken"),
    expect: (session) =>
      session.failed("external input broken while stopped", /not assignable/),
  },
  {
    name: "external input repaired while stopped",
    edit: (project) => project.shape("ok"),
    expect: (session) =>
      session.settled("external input repaired while stopped", "THIRD", []),
  },
];

/**
 * Run every restart step on one project: open a session over the host's
 * persistent cache, settle it, prove the cache stored, stop it, edit, and open
 * the next.
 *
 * @param project The fixture, on its first value.
 * @param open Opens a session with the host's persistent cache on; the session
 *   reports `stored()` once its cache is on disk.
 * @param name The host, for the failure's name.
 */
export async function restartContract(project, open, name) {
  const cycle = async (label, expect) => {
    const session = await open(project);
    try {
      await expect(session);
    } catch (error) {
      throw new Error(`${name}: ${label}: ${error.stack ?? error}`, {
        cause: error,
      });
    } finally {
      await session.close();
    }
    await eventually(
      () => session.stored(),
      Boolean,
      `${name}: ${label}: the persistent cache is stored`,
    );
  };
  await cycle("first session", (session) =>
    session.settled("first build", "FIRST", []),
  );
  for (const step of RESTART_STEPS) {
    step.edit(project);
    await cycle(step.name, (session) => step.expect(session, project));
  }
}

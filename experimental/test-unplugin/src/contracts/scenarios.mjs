import assert from "node:assert/strict";
import path from "node:path";

import { contractInput, write } from "./common.mjs";

/**
 * The one list of edits every host must converge on, in one watching session,
 * on every OS, for a project named directly and for one named through a link.
 *
 * Each host opens a session (`hosts/*.mjs`) that says how the contract sees the
 * host's output and its failures, and which seams it offers; the scenarios
 * themselves are the same for all. A host that converges on every scenario
 * hears every kind of edit the adapter promises to hear: between builds, during
 * the compile, after ttsc returned a module and before the host's build ended,
 * during the host's own build, saved the way an editor saves, deleted and
 * recreated, and to an input the module depends on for the first time.
 *
 * A scenario is `{ name, run }`; `run` receives the session and the project,
 * and `when` says which sessions it applies to. The compile count is asserted
 * only where the host's session counts compiles exactly.
 */
export const SCENARIOS = [
  {
    name: "initial failure and repair",
    async run({ project, session }) {
      // The session opened on a broken input.
      await session.failed("initial failure", /invalid contract type/);
      project.change("FIRST");
      await session.settled("first build", "FIRST", [project.input]);
      if (session.exactRuns)
        assert.equal(project.runs(), 1, "one compile for the four modules");
    },
  },
  {
    name: "edit between builds",
    async run({ project, session }) {
      const before = project.runs();
      project.change("SECOND");
      await session.settled("edit between builds", "SECOND", [project.input]);
      if (session.exactRuns)
        assert.equal(
          project.runs(),
          2,
          "one compile shared across the rebuilt modules",
        );
      // A host with several compilers, or a pool of workers, still compiles
      // the edit once for all of them where its session says so.
      await session.sharedEdit?.(before);
    },
  },
  {
    name: "edit again",
    async run({ project, session }) {
      project.change("THIRD");
      await session.settled("second edit", "THIRD", [project.input]);
      if (session.exactRuns) assert.equal(project.runs(), 3);
    },
  },
  {
    name: "break and recover",
    async run({ project, session }) {
      project.break();
      await session.failed("failed rebuild", /invalid contract type/, [
        project.input,
      ]);
      project.change("FOURTH");
      await session.settled("recovered rebuild", "FOURTH", [project.input]);
      if (session.exactRuns) assert.equal(project.runs(), 4);
    },
  },
  {
    name: "unchanged rebuild",
    when: (session) => session.rebuild !== undefined,
    async run({ project, session }) {
      const before = project.runs();
      await session.rebuild("FOURTH");
      assert.equal(
        project.runs(),
        before,
        "an unchanged rebuild reuses its generation",
      );
    },
  },
  {
    name: "edit during the compile",
    async run({ project, session }) {
      // The fixture plugin rewrites a `RACE_` value without the prefix right
      // after reading it: the edit lands while the compile is running.
      project.change("RACE_FIFTH");
      await session.settled("edit during the compile", "FIFTH", [
        project.input,
      ]);
    },
  },
  {
    name: "new input during the compile",
    async run({ project, session }) {
      project.sibling("late", "RACE_SIXTH");
      project.change("FROM_LATE");
      await session.settled("new input during the compile", "SIXTH", [
        project.input,
        path.join(project.root, "src", "late-input.server.ts"),
      ]);
    },
  },
  {
    name: "edit after ttsc returned",
    when: (session) => session.lateRace,
    async run({ project, session }) {
      // A seam the host places after ttsc rewrites a `LATE_RACE_` value: the
      // edit lands after ttsc registered the input and returned the module,
      // while the host is still building.
      project.change("LATE_RACE_SEVENTH");
      await session.settled("edit after ttsc returned", "SEVENTH", [
        project.input,
      ]);
    },
  },
  {
    name: "new input after ttsc returned",
    when: (session) => session.lateRace,
    async run({ project, session }) {
      project.sibling("newer", "LATE_RACE_EIGHTH");
      project.change("FROM_NEWER");
      await session.settled("new input after ttsc returned", "EIGHTH", [
        project.input,
        path.join(project.root, "src", "newer-input.server.ts"),
      ]);
    },
  },
  {
    name: "two edits in one tick",
    async run({ project, session }) {
      // The second edit lands while the host is still reacting to the first,
      // during its own build at the latest.
      project.change("NINTH");
      project.change("TENTH");
      await session.settled("two edits in one tick", "TENTH", [project.input]);
    },
  },
  {
    name: "edit during the host's build",
    when: (session) => session.buildStarted !== undefined,
    async run({ project, session }) {
      // Touch a module the host itself watches, so the host builds; the input
      // is edited once the host reports that build started, while it runs.
      const started = session.buildStarted();
      write(
        project.root,
        "src/mod1.ts",
        "export const value = watchValue();\n// touched\n",
      );
      await started;
      project.change("ELEVENTH");
      await session.settled("edit during the host's build", "ELEVENTH", [
        path.join(project.root, "src", "mod1.ts"),
        project.input,
      ]);
    },
  },
  {
    name: "saved by an editor",
    async run({ project, session }) {
      project.save("TWELFTH");
      await session.settled("saved by an editor", "TWELFTH", [project.input]);
    },
  },
  {
    name: "deleted and recreated",
    async run({ project, session }) {
      project.remove();
      await session.failed(
        "deleted input",
        /contract-input|ENOENT|not found/i,
        [project.input],
      );
      project.change("THIRTEENTH");
      await session.settled("recreated input", "THIRTEENTH", [project.input]);
    },
  },
  {
    name: "new root file",
    when: (session) => session.membership,
    async run({ project, session }) {
      // A root file appearing changes no compiler input the modules read, so
      // only the project's root-file membership hears it; the generation is
      // compiled again and every module keeps its value.
      const before = project.runs();
      write(
        project.root,
        "src/contract-extra.d.ts",
        "declare const extra: 1;\n",
      );
      await session.recompiled("new root file", before, [
        path.join(project.root, "src", "contract-extra.d.ts"),
      ]);
      await session.settled("value after a new root file", "THIRTEENTH", []);
    },
  },
  {
    name: "final edit",
    async run({ project, session }) {
      project.change("FOURTEENTH");
      await session.settled("final edit", "FOURTEENTH", [project.input]);
    },
  },
];

/**
 * Run every applicable scenario on one session, and name the scenario a failure
 * came from.
 */
export async function runScenarios(project, session) {
  for (const scenario of SCENARIOS) {
    if (scenario.when !== undefined && !scenario.when(session)) continue;
    try {
      await scenario.run({ project, session });
    } catch (error) {
      throw new Error(
        `${session.name}${project.linked ? " (linked root)" : ""}: ${scenario.name}: ${error.stack ?? error}`,
        { cause: error },
      );
    }
  }
}

export { contractInput };

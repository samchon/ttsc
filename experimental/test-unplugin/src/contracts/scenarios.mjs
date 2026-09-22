import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BROKEN_INPUT, recordStates, write } from "./common.mjs";

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
 * recreated, to an input the module depends on for the first time, to the
 * tsconfig itself and to the config it extends, a dependency and a dependency's
 * directory renamed away and back, an import that does not exist until its file
 * appears, a declaration no bundler loads, and an input outside the project
 * root.
 *
 * A scenario is `{ name, run }`; `run` receives the session and the project,
 * and `when` says which sessions and projects it applies to. A scenario whose
 * observable is the compiler's verdict applies to the linked plugin only: the
 * source plugin's envelope carries no verdict beyond the plugin's own. The
 * compile count is asserted only where the host's session counts compiles
 * exactly.
 */
export const SCENARIOS = [
  {
    name: "initial failure and repair",
    async run({ project, session }) {
      // The session opened on a broken input.
      await session.failed("initial failure", BROKEN_INPUT);
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
      await session.failed("failed rebuild", BROKEN_INPUT, [project.input]);
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
    name: "edit to the tsconfig",
    async run({ project, session }) {
      // The tsconfig is a compiler input of every module: a plugin entry it
      // gains changes the output, and the edit is heard through the config
      // chain the generation registered.
      project.change("FOURTEENTH");
      await session.settled("edit before the tsconfig", "FOURTEENTH", [
        project.input,
      ]);
      project.configure("CONFIGURED");
      await session.settled("edit to the tsconfig", "CONFIGURED", [
        project.tsconfig,
      ]);
      project.configure(undefined);
      await session.settled("tsconfig restored", "FOURTEENTH", [
        project.tsconfig,
      ]);
    },
  },
  {
    name: "dependency renamed away and back",
    async run({ project, session }) {
      // A dependency moved out from under the module is a failure the host
      // must report, and moved back it must be found again: the watcher hears
      // a rename, not a write.
      const late = project.siblingPath("late");
      const away = `${late}.moved`;
      project.change("FROM_LATE");
      await session.settled("dependency in place", "SIXTH", [project.input]);
      fs.renameSync(late, away);
      await session.failed(
        "dependency renamed away",
        /late-input|ENOENT|not found/i,
        [late],
      );
      fs.renameSync(away, late);
      await session.settled("dependency renamed back", "SIXTH", [late]);
    },
  },
  {
    name: "missing import that appears",
    when: (_, project) => project.plugin === "linked",
    async run({ project, session }) {
      // The entry gains an import of a declaration that does not exist: the
      // compiler reports it, and the file appearing under the name it resolved
      // repairs the module the host never heard change again.
      project.importLater(true);
      await session.failed("missing import", /Cannot find module|TS2307/, [
        project.entry,
      ]);
      project.later();
      await session.settled("missing import created", "SIXTH", [
        project.laterDeclaration,
      ]);
    },
  },
  {
    name: "declaration broken and repaired",
    when: (_, project) => project.plugin === "linked",
    async run({ project, session }) {
      // A declaration inside the project that no bundler loads is still an
      // input of the entry: only the compiler's verdict on it changes.
      project.local("broken");
      await session.failed("declaration broken", /not assignable/, [
        project.localDeclaration,
      ]);
      project.local("ok");
      await session.settled("declaration repaired", "SIXTH", [
        project.localDeclaration,
      ]);
    },
  },
  {
    name: "external input broken and repaired",
    when: (_, project) => project.plugin === "linked",
    async run({ project, session }) {
      // A declaration outside the project root is an input the compiler reads
      // and the project does not contain; the module never changes, only the
      // verdict on it does.
      project.shape("broken");
      await session.failed("external input broken", /not assignable|TS2322/, [
        project.externalDeclaration,
      ]);
      project.shape("ok");
      await session.settled("external input repaired", "SIXTH", [
        project.externalDeclaration,
      ]);
    },
  },
  {
    name: "edit to the extended config",
    async run({ project, session }) {
      // The base config is reached only through the tsconfig's extends
      // chain; a plugin entry it gains changes every consumer's value.
      project.configureBase("CONFIGURED");
      await session.settled("edit to the extended config", "CONFIGURED", [
        project.baseTsconfig,
      ]);
      project.configureBase(undefined);
      await session.settled("extended config restored", "SIXTH", [
        project.baseTsconfig,
      ]);
    },
  },
  {
    name: "dependency directory renamed away and back",
    when: (_, project) => project.plugin === "linked",
    async run({ project, session }) {
      // The directory holding a dependency moves, which no watcher of the
      // file itself hears: the file's own path emits nothing when its parent
      // is renamed, only the parent's parent does.
      const away = `${project.depsDirectory}.moved`;
      fs.renameSync(project.depsDirectory, away);
      await session.failed(
        "dependency directory renamed away",
        /Cannot find module|TS2307/,
        [project.localDeclaration],
      );
      fs.renameSync(away, project.depsDirectory);
      await session.settled("dependency directory renamed back", "SIXTH", [
        project.localDeclaration,
      ]);
    },
  },
  {
    name: "final edit",
    async run({ project, session }) {
      project.change("FIFTEENTH");
      await session.settled("final edit", "FIFTEENTH", [project.input]);
    },
  },
];

/**
 * Run every applicable scenario on one session, and name the scenario a failure
 * came from.
 */
export async function runScenarios(project, session) {
  for (const scenario of SCENARIOS) {
    if (scenario.when !== undefined && !scenario.when(session, project))
      continue;
    // The records as the scenario begins, against which the records it failed
    // on say whether the adapter signalled the edit at all: the record is the
    // only thing a build host is handed, so its signal tells an edit the
    // adapter never heard from one the host did not act on.
    const before = recordStates(project);
    try {
      await scenario.run({ project, session });
    } catch (error) {
      throw new Error(
        [
          `${session.name}${project.linked ? " (linked root)" : ""}${project.plugin === "linked" ? " (linked plugin)" : ""}: ${scenario.name}: ${error.stack ?? error}`,
          `records when the scenario began: ${JSON.stringify(before)}`,
          `records now: ${JSON.stringify(recordStates(project))}`,
        ].join("\n"),
        { cause: error },
      );
    }
  }
}

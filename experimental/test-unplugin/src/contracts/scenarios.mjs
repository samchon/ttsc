
import { recordStates } from "./common.mjs";
import { test_host_initial_failure_and_repair } from "./scenarios/test_host_initial_failure_and_repair.mjs";
import { test_host_edit_between_builds } from "./scenarios/test_host_edit_between_builds.mjs";
import { test_host_edit_again } from "./scenarios/test_host_edit_again.mjs";
import { test_host_break_and_recover } from "./scenarios/test_host_break_and_recover.mjs";
import { test_host_unchanged_rebuild } from "./scenarios/test_host_unchanged_rebuild.mjs";
import { test_host_edit_during_the_compile } from "./scenarios/test_host_edit_during_the_compile.mjs";
import { test_host_new_input_during_the_compile } from "./scenarios/test_host_new_input_during_the_compile.mjs";
import { test_host_edit_after_ttsc_returned } from "./scenarios/test_host_edit_after_ttsc_returned.mjs";
import { test_host_new_input_after_ttsc_returned } from "./scenarios/test_host_new_input_after_ttsc_returned.mjs";
import { test_host_two_edits_in_one_tick } from "./scenarios/test_host_two_edits_in_one_tick.mjs";
import { test_host_edit_during_the_host_s_build } from "./scenarios/test_host_edit_during_the_host_s_build.mjs";
import { test_host_saved_by_an_editor } from "./scenarios/test_host_saved_by_an_editor.mjs";
import { test_host_deleted_and_recreated } from "./scenarios/test_host_deleted_and_recreated.mjs";
import { test_host_new_root_file } from "./scenarios/test_host_new_root_file.mjs";
import { test_host_edit_to_the_tsconfig } from "./scenarios/test_host_edit_to_the_tsconfig.mjs";
import { test_host_dependency_renamed_away_and_back } from "./scenarios/test_host_dependency_renamed_away_and_back.mjs";
import { test_host_missing_import_that_appears } from "./scenarios/test_host_missing_import_that_appears.mjs";
import { test_host_declaration_broken_and_repaired } from "./scenarios/test_host_declaration_broken_and_repaired.mjs";
import { test_host_external_input_broken_and_repaired } from "./scenarios/test_host_external_input_broken_and_repaired.mjs";
import { test_host_edit_to_the_extended_config } from "./scenarios/test_host_edit_to_the_extended_config.mjs";
import { test_host_dependency_directory_renamed_away_and_back } from "./scenarios/test_host_dependency_directory_renamed_away_and_back.mjs";
import { test_host_final_edit } from "./scenarios/test_host_final_edit.mjs";

/**
 * The one list of edits every host must converge on, in one watching session,
 * in the Linux boundary batch, through each selected producer/root connection.
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
    run: test_host_initial_failure_and_repair,
  },
  {
    name: "edit between builds",
    run: test_host_edit_between_builds,
  },
  {
    name: "edit again",
    run: test_host_edit_again,
  },
  {
    name: "break and recover",
    run: test_host_break_and_recover,
  },
  {
    name: "unchanged rebuild",
    when: (session) => session.rebuild !== undefined,
    run: test_host_unchanged_rebuild,
  },
  {
    name: "edit during the compile",
    run: test_host_edit_during_the_compile,
  },
  {
    name: "new input during the compile",
    run: test_host_new_input_during_the_compile,
  },
  {
    name: "edit after ttsc returned",
    when: (session) => session.lateRace,
    run: test_host_edit_after_ttsc_returned,
  },
  {
    name: "new input after ttsc returned",
    when: (session) => session.lateRace,
    run: test_host_new_input_after_ttsc_returned,
  },
  {
    name: "two edits in one tick",
    run: test_host_two_edits_in_one_tick,
  },
  {
    name: "edit during the host's build",
    when: (session) => session.buildStarted !== undefined,
    run: test_host_edit_during_the_host_s_build,
  },
  {
    name: "saved by an editor",
    run: test_host_saved_by_an_editor,
  },
  {
    name: "deleted and recreated",
    run: test_host_deleted_and_recreated,
  },
  {
    name: "new root file",
    when: (session) => session.membership,
    run: test_host_new_root_file,
  },
  {
    name: "edit to the tsconfig",
    run: test_host_edit_to_the_tsconfig,
  },
  {
    name: "dependency renamed away and back",
    run: test_host_dependency_renamed_away_and_back,
  },
  {
    name: "missing import that appears",
    when: (_, project) => project.plugin === "linked",
    run: test_host_missing_import_that_appears,
  },
  {
    name: "declaration broken and repaired",
    when: (_, project) => project.plugin === "linked",
    run: test_host_declaration_broken_and_repaired,
  },
  {
    name: "external input broken and repaired",
    when: (_, project) => project.plugin === "linked",
    run: test_host_external_input_broken_and_repaired,
  },
  {
    name: "edit to the extended config",
    run: test_host_edit_to_the_extended_config,
  },
  {
    name: "dependency directory renamed away and back",
    when: (_, project) => project.plugin === "linked",
    run: test_host_dependency_directory_renamed_away_and_back,
  },
  {
    name: "final edit",
    run: test_host_final_edit,
  },
];

/**
 * Run every applicable scenario on one session, and name the scenario a failure
 * came from.
 */
export async function runScenarios(project, session, scenarios = SCENARIOS) {
  for (const scenario of scenarios) {
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
          ...(session.output === undefined
            ? []
            : [`what the host reported:\n${session.output()}`]),
          ...(session.diagnostics === undefined ? [] : [session.diagnostics()]),
        ].join("\n"),
        { cause: error },
      );
    }
  }
}

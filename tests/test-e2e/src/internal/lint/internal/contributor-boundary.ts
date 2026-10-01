import { FixtureFiles } from "../../FixtureFiles";
import { createLintProject, runLintProject } from "./config-file";

/** One immutable contributor producer and one real project load for three wire consumers. */
let completed: ReturnType<typeof runLintProject> | undefined;
let failed: { error: unknown } | undefined;

export function contributorBoundaryResult(): ReturnType<typeof runLintProject> {
  if (failed) throw failed.error;
  if (completed) return completed;
  try {
    const project = createLintProject({
      name: "contributor-wire-batch",
      source: "// FIXME: this should fire\nexport const value = 1;\n",
      pluginConfig: { configFile: "./lint.config.ts" },
      extraSources: FixtureFiles.read("lint/contributor-boundary/inputs-1"),
      linkNodeModules: ["lint-contributor-demo"],
    });
    try {
      completed = runLintProject(project.tmpdir);
      return completed;
    } finally {
      project.cleanup();
    }
  } catch (error) {
    failed = { error };
    throw error;
  }
}

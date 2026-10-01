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
      extraSources: {
        "src/diagnostic-stream.ts": "// TODO: rewrite this loop\nexport const value = 1;\n// FIXME: handle negative input\nexport const other = value + 1;\n",
        "src/options.ts": "// XXX: custom marker user opted into\nexport const value = 1;\n// TODO: default marker the user opted out of\nexport const other = value + 1;\n",
        "lint.config.ts": `import type { ITtscLintConfig } from "@ttsc/lint";
import demoPlugin from "lint-contributor-demo";

export default {
  plugins: { demo: demoPlugin },
  rules: {
    "demo/no-todo-comment": "error",
    "demo/no-marker-comment": ["error", { markers: ["XXX"] }],
  },
} satisfies ITtscLintConfig;
`,
      },
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

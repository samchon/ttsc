import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies lint contributor protocol: a user-supplied `markers` array threads
 * from `lint.config.ts` through the wire chain into the contributor's Go
 * `ctx.DecodeOptions` call.
 *
 * The unit test for the same surface
 * (`contributor_rule_decodes_options_through_public_context_test.go`)
 * constructs an in-process synthetic rule and bypasses the build pipeline. This
 * scenario crosses every real boundary: JS factory resolves the demo package,
 * ttsc copies its Go source into the host binary, the synthesized `init()`
 * registers `demo/no-marker-comment` before `main`, the engine populates
 * `ctx.Options` with the user's blob, and the rule's `DecodeOptions` reads
 * `markers`. A regression in any boundary would leave the rule silently running
 * with default markers, so the assertion checks the _negative_ anchor (a TODO
 * comment is NOT flagged because the user overrode the marker list).
 *
 * 1. Materialize a lint fixture with one `XXX:` and one `TODO:` comment.
 * 2. Configure `demo/no-marker-comment` with `markers: ["XXX"]` only.
 * 3. Assert exactly one diagnostic fires — the XXX line — and the TODO line is
 *    left untouched because the user-supplied options narrowed the marker set.
 */
export const test_lint_contributor_rule_decodes_user_options_through_wire_chain =
  () => {
    const source =
      "// XXX: custom marker user opted into\n" +
      "export const value = 1;\n" +
      "// TODO: default marker the user opted out of\n" +
      "export const other = value + 1;\n";

    const project = createLintProject({
      name: "contributor-options",
      source,
      pluginConfig: {
        plugins: { demo: "lint-contributor-demo" },
        rules: {
          "demo/no-marker-comment": ["error", { markers: ["XXX"] }],
        },
      },
      linkNodeModules: ["lint-contributor-demo"],
    });
    try {
      const result = runLintProject(project.tmpdir);

      assert.notEqual(
        result.status,
        0,
        `expected non-zero exit when contributor rule fires; stderr:\n${result.stderr}`,
      );
      const messages = result.diagnostics.map((d) => ({
        rule: d.rule,
        severity: d.severity,
        message: d.message,
      }));
      assert.deepEqual(
        messages,
        [
          {
            rule: "demo/no-marker-comment",
            severity: "error",
            message: "XXX marker is not allowed.",
          },
        ],
        `default markers leaked through (TODO should not fire when user overrode markers):\n${result.stderr}`,
      );
    } finally {
      project.cleanup();
    }
  };

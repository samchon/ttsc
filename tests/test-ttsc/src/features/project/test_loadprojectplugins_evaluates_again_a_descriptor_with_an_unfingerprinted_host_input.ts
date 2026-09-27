import { createDescriptorEvaluationProject } from "../../internal/descriptor-evaluation";
import { assert, fs, path } from "../../internal/project";

/**
 * Verifies a descriptor that declares a host input without its fingerprint is
 * evaluated by every load.
 *
 * The protocol reports an input whose state a descriptor could not prove, such
 * as one it observed in two states, by keeping it in `hostInputs` and omitting
 * its `hostInputHashes` entry; `@ttsc/lint` does so for a config it read while
 * the file moved. The descriptor evaluation cache took such an input for one
 * the descriptor had not read and recorded the answer, which then outlived an
 * edit to the file (samchon/ttsc#1561).
 *
 * 1. Load a project whose descriptor names itself from `settings.json`, declaring
 *    it in `hostInputs` alone, next to an empty `hostInputHashes`.
 * 2. Edit `settings.json`, and load again with the same cache.
 * 3. Assert the second load answers the new name and evaluated again.
 */
export const test_loadprojectplugins_evaluates_again_a_descriptor_with_an_unfingerprinted_host_input =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-unproven-input-",
      { "settings.json": JSON.stringify({ name: "first" }) },
      [
        `  const settings = path.join(context.dirname, "settings.json");`,
        `  return {`,
        `    hostInputHashes: {},`,
        `    hostInputs: [settings],`,
        `    name: JSON.parse(fs.readFileSync(settings, "utf8")).name,`,
        `    source: path.join(context.dirname, "go-plugin"),`,
        `  };`,
      ].join("\n"),
    );
    assert.equal(project.load(), "first");
    fs.writeFileSync(
      path.join(project.directory, "settings.json"),
      JSON.stringify({ name: "second" }),
    );
    assert.equal(
      project.load(),
      "second",
      "the unproven input was served stale",
    );
    assert.equal(project.evaluations(), 2);
  };

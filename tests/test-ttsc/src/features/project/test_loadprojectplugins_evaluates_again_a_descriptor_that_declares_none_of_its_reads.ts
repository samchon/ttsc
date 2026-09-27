import { createDescriptorEvaluationProject } from "../../internal/descriptor-evaluation";
import { assert, fs, path } from "../../internal/project";

/**
 * Verifies a descriptor that reads a file without declaring it is evaluated by
 * every load, so an edit to that file reaches the next load.
 *
 * The descriptor evaluation cache proved an answer by the modules and
 * resolution candidates the evaluation recorded and the fingerprints the
 * descriptor declared. A plain `fs.readFileSync` in the factory is none of
 * these, so the cache kept handing out the answer computed from the file's
 * first content for as long as the module graph held still (samchon/ttsc#1561).
 * No runtime ttsc supports can observe the read on every Node release, so an
 * answer is recorded only for a descriptor that declares what it read
 * (`hostInputHashes`).
 *
 * 1. Load a project whose descriptor names itself from `settings.json`, read
 *    without a declaration.
 * 2. Edit `settings.json`, and load again with the same cache.
 * 3. Assert the second load answers the new name and evaluated again.
 */
export const test_loadprojectplugins_evaluates_again_a_descriptor_that_declares_none_of_its_reads =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-undeclared-read-",
      { "settings.json": JSON.stringify({ name: "first" }) },
      [
        `  const settings = path.join(context.dirname, "settings.json");`,
        `  return {`,
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
      "the undeclared read was served stale",
    );
    assert.equal(project.evaluations(), 2);
  };

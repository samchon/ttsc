import { createDescriptorEvaluationProject } from "../../internal/descriptor-evaluation";
import { assert, fs, path } from "../../internal/project";

/**
 * Verifies a descriptor that declares the file it reads, with the state it read
 * it in, keeps its evaluation across loads until that file changes.
 *
 * An answer is recorded only for a descriptor that declares what it read
 * (samchon/ttsc#1561), and a declared fingerprint proves the answer like a
 * module its graph loaded (samchon/ttsc#1497).
 *
 * 1. Load a project whose descriptor names itself from `settings.json` and
 *    declares it in `hostInputs` with its `hostInputHashes` digest, twice.
 * 2. Edit `settings.json`, and load again with the same cache.
 * 3. Assert the factory ran once for the first two loads and again after the edit,
 *    which the third load answers.
 */
export const test_loadprojectplugins_reuses_a_descriptor_that_fingerprints_its_reads =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-declared-read-",
      { "settings.json": JSON.stringify({ name: "first" }) },
      [
        `  const settings = path.join(context.dirname, "settings.json");`,
        `  const text = fs.readFileSync(settings);`,
        `  const digest = require("node:crypto").createHash("sha256").update(text).digest("hex");`,
        `  return {`,
        `    hostInputHashes: { [settings]: digest },`,
        `    hostInputs: [settings],`,
        `    name: JSON.parse(text.toString("utf8")).name,`,
        `    source: path.join(context.dirname, "go-plugin"),`,
        `  };`,
      ].join("\n"),
    );
    assert.equal(project.load(), "first");
    assert.equal(project.load(), "first");
    assert.equal(project.evaluations(), 1, "a declared read was not reused");
    fs.writeFileSync(
      path.join(project.directory, "settings.json"),
      JSON.stringify({ name: "second" }),
    );
    assert.equal(project.load(), "second");
    assert.equal(
      project.evaluations(),
      2,
      "an edited declared read was reused",
    );
  };

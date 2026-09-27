import { createDescriptorEvaluationProject } from "../../internal/descriptor-evaluation";
import { assert, fs, path } from "../../internal/project";

/**
 * Verifies a load in the default cache root records its use of a reused
 * descriptor evaluation and collects the evaluations nobody uses.
 *
 * `descriptors/` gained one file per key and nothing removed any
 * (samchon/ttsc#1562). The default root now collects it with the plugin
 * binaries, and a hit records a use, so an answer launches keep reusing is not
 * evicted by its age.
 *
 * 1. Load a project whose descriptor declares it reads nothing, in the default
 *    project-local cache root.
 * 2. Age its recorded evaluation past the retention window, add another aged
 *    entry, and let the daily collection run again.
 * 3. Load again, and assert the evaluation was reused, its entry survives with a
 *    fresh use, and the other entry is gone.
 */
export const test_loadprojectplugins_keeps_used_descriptor_evaluations_and_collects_unused_ones =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-collection-",
      {},
      [
        `  return {`,
        `    hostInputHashes: {},`,
        `    name: "collected",`,
        `    source: path.join(context.dirname, "go-plugin"),`,
        `  };`,
      ].join("\n"),
      { defaultCacheRoot: true },
    );
    assert.equal(project.load(), "collected");
    const descriptors = path.join(project.cacheRoot, "descriptors");
    const entries = fs
      .readdirSync(descriptors)
      .filter((name) => name.endsWith(".json"));
    assert.equal(entries.length, 1, entries.join(", "));
    const used = path.join(descriptors, entries[0]!);
    const unused = path.join(descriptors, "unused.json");
    fs.writeFileSync(unused, "{}", "utf8");
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    for (const file of [used, unused]) fs.utimesSync(file, old, old);
    fs.rmSync(path.join(descriptors, ".gc-last-run"), { force: true });

    assert.equal(project.load(), "collected");
    assert.equal(project.evaluations(), 1, "the evaluation was not reused");
    assert.equal(fs.existsSync(unused), false, "an unused entry was kept");
    assert.equal(fs.existsSync(used), true, "an entry in use was collected");
    assert.ok(
      fs.statSync(used).mtimeMs > old.getTime(),
      "the hit recorded no use",
    );
  };

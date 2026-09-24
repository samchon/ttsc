import assert from "node:assert/strict";
import path from "node:path";
import { pluginSourceCovers } from "ttsc/plugin-source";

/**
 * Verifies `pluginSourceCovers` answers which paths below a plugin source bear
 * on its state by the rule the build prunes by, for a directory a host would
 * watch and for the path an event names (samchon/ttsc#1492).
 *
 * `ttsc --watch` and `@ttsc/unplugin` both decide what they hear of a plugin's
 * Go module with it, so the two cannot disagree about a path, and neither
 * watches what the build never reads. It used to live in the adapter alone,
 * where a sibling named `..tools` read as a path outside the source.
 *
 * 1. Assert the source itself, and a package below it, are covered either way.
 * 2. Assert a directory the build prunes, and everything below one, is not
 *    covered, while an event naming a pruned name itself is, since a file of
 *    that name is one the build reads.
 * 3. Assert a path outside the source is not covered, and a child whose name
 *    starts with two dots is.
 */
export const test_plugin_source_covers_answers_by_the_build_prune_rule =
  (): void => {
    const root = path.resolve("plugin-module");

    // 1. The source and its packages.
    for (const kind of ["directory", "entry"] as const) {
      assert.equal(pluginSourceCovers(root, root, kind), true, kind);
      assert.equal(
        pluginSourceCovers(root, path.join(root, "internal", "mark"), kind),
        true,
        kind,
      );
    }
    assert.equal(
      pluginSourceCovers(root, path.join(root, "internal", "mark.go"), "entry"),
      true,
    );

    // 2. What the build passes over.
    for (const pruned of ["node_modules", ".git", ".ttsc"]) {
      assert.equal(
        pluginSourceCovers(root, path.join(root, pruned), "directory"),
        false,
        pruned,
      );
      assert.equal(
        pluginSourceCovers(root, path.join(root, pruned), "entry"),
        true,
        `a file named ${pruned} is read`,
      );
      assert.equal(
        pluginSourceCovers(root, path.join(root, pruned, "x", "y.go"), "entry"),
        false,
        pruned,
      );
      assert.equal(
        pluginSourceCovers(
          root,
          path.join(root, "pkg", pruned, "x"),
          "directory",
        ),
        false,
        pruned,
      );
    }

    // 3. Outside, and a name that only starts with two dots.
    assert.equal(
      pluginSourceCovers(root, path.join(path.dirname(root), "other"), "entry"),
      false,
    );
    assert.equal(
      pluginSourceCovers(root, path.dirname(root), "directory"),
      false,
    );
    assert.equal(
      pluginSourceCovers(root, path.join(root, "..tools", "gen.go"), "entry"),
      true,
    );
  };

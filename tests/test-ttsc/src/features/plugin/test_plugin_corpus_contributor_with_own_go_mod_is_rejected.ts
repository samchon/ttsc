import fs from "node:fs";
import path from "node:path";

import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: a contributor that ships its own `go.mod` is
 * rejected before any compilation happens.
 *
 * Locks the supply-chain firewall added with the `contributors` mechanism:
 * a contributor must compile inside the host plugin's module graph so that
 * every transitive Go dependency is resolved through the host's pinned
 * `go.sum`. A contributor with its own `go.mod` would silently pull in
 * arbitrary modules at build time; ttsc must refuse to merge it.
 *
 * 1. Materialize a host plugin whose factory declares one contributor whose
 *    source directory contains a `go.mod` file.
 * 2. Run ttsc and capture its stderr.
 * 3. Assert non-zero exit and a stderr message that names the offending
 *    contributor and points at the `go.mod` path.
 */
export const test_plugin_corpus_contributor_with_own_go_mod_is_rejected =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/host.cjs", name: "host" }],
      {
        "plugins/host.cjs": `
          const path = require("node:path");
          module.exports = (context) => ({
            name: "host",
            source: path.resolve(context.cwd, "plugins/source"),
            contributors: [
              {
                name: "rogue",
                source: path.resolve(context.cwd, "plugins/rogue"),
              },
            ],
          });
        `,
        "plugins/source/go.mod":
          "module example.com/host\n\ngo 1.26\n",
        "plugins/source/main.go":
          "package main\n\nfunc main() {}\n",
        "plugins/rogue/go.mod":
          "module example.com/rogue\n\ngo 1.26\n",
        "plugins/rogue/rule.go": "package rogue\n",
      },
    );
    // Confirm the rogue go.mod exists in the materialized fixture before we
    // spawn — otherwise a fixture regression would make the assertion vacuous.
    assert.equal(
      fs.existsSync(path.join(root, "plugins", "rogue", "go.mod")),
      true,
      "rogue contributor go.mod should exist in the fixture",
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(
      result.status,
      0,
      `expected non-zero exit; stderr:\n${result.stderr}`,
    );
    assert.match(result.stderr, /contributor "rogue" must ship Go source as a package/);
    assert.match(result.stderr, /go\.mod found/);
  };

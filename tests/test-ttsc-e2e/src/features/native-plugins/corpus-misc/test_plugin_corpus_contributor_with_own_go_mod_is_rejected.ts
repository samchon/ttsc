import fs from "node:fs";
import path from "node:path";

import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: a contributor that ships its own `go.mod` is rejected
 * before any compilation happens.
 *
 * Locks the supply-chain firewall added with the `contributors` mechanism: a
 * contributor must compile inside the host plugin's module graph so that every
 * transitive Go dependency is resolved through the host's pinned `go.sum`. A
 * contributor with its own `go.mod` would silently pull in arbitrary modules at
 * build time; ttsc must refuse to merge it.
 *
 * 1. Materialize a host plugin whose factory declares one contributor whose source
 *    directory contains a `go.mod` file.
 * 2. Run ttsc and capture its stderr.
 * 3. Assert non-zero exit and a stderr message that names the offending
 *    contributor and points at the `go.mod` path.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --emit rejects the rogue contributor with the contributor name and go.mod-found reason.
 * @evidence contracts/testing.md#independent-expectations Contributors must use the host module graph; the authored rogue module deliberately violates that contract.
 * @evidence contracts/testing.md#distinguishing-cases A contributor carrying its own module is refused before compilation; valid contributed rules are exercised by the lifecycle case.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_contributor_with_own_go_mod_is_rejected entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The actual CLI evaluates the host descriptor and validates its contributor module graph before compiling. The named rejection proves the launcher does not forward a separate contributor module into the native workspace; no native build success is claimed by this negative case.
 * @evidence contracts/e2e.md#shared-execution One temporary consumer and one invocation of the already built CLI suffice for this descriptor/discovery rejection. No native build is required or claimed; sharing the built launcher does not share mutable package exports, contributor modules or config absence across consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit rejects the rogue contributor with the contributor name and go.mod-found reason. These assertions stay in test_plugin_corpus_contributor_with_own_go_mod_is_rejected with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
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
        "plugins/source/go.mod": "module example.com/host\n\ngo 1.26\n",
        "plugins/source/main.go": "package main\n\nfunc main() {}\n",
        "plugins/rogue/go.mod": "module example.com/rogue\n\ngo 1.26\n",
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
    assert.match(
      result.stderr,
      /contributor "rogue" must ship Go source as a package/,
    );
    assert.match(result.stderr, /go\.mod found/);
  };

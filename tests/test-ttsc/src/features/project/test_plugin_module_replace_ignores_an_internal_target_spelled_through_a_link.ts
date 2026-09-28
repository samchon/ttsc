import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pluginModuleReplaceDirectories } from "../../../../../packages/ttsc/lib/plugin/internal/source/pluginModuleReplaceDirectories.js";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a local replacement inside a module stays internal through a link.
 *
 * A module root and its `replace` target can name the same tree through
 * different links, or through Windows' long and 8.3 spellings. Comparing those
 * strings without one physical resolver reports an internal target as a second
 * external plugin source and watches and keys it twice.
 *
 * 1. Create a Go module and link another path to that module.
 * 2. Name one of its own directories through the link in `go.mod`.
 * 3. Assert no external replacement directory is reported.
 */
export const test_plugin_module_replace_ignores_an_internal_target_spelled_through_a_link =
  (): void => {
    const root = TestProject.tmpdir("ttsc-internal-replace-link-");
    const module = path.join(root, "module");
    const linked = path.join(root, "linked-module");
    const internal = path.join(module, "internal");
    fs.mkdirSync(internal, { recursive: true });
    fs.symlinkSync(module, linked, "junction");
    fs.writeFileSync(
      path.join(module, "go.mod"),
      [
        "module example.com/plugin",
        "",
        "go 1.26",
        "",
        "require example.com/internal v0.0.0",
        "",
        `replace example.com/internal => ${path
          .join(linked, "internal")
          .split(path.sep)
          .join("/")}`,
        "",
      ].join("\n"),
      "utf8",
    );
    const fakeGoRoot = path.join(root, "fake-go");
    fs.mkdirSync(fakeGoRoot);
    const go = createFakeGoBinary(fakeGoRoot);

    assert.deepEqual(
      pluginModuleReplaceDirectories(
        module,
        { ...process.env, TTSC_GO_BINARY: go },
        go,
      ),
      [],
    );
  };

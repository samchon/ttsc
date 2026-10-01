import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadProjectPlugins } from "../../../../../packages/ttsc/src/plugin/internal/load/loadProjectPlugins";

/**
 * Verifies a malformed package manifest is reported by name during plugin
 * discovery.
 *
 * Plugin auto-discovery reads the project's `package.json` and one manifest per
 * direct dependency with an unguarded `JSON.parse`, so a broken manifest threw
 * the bare V8 message. These are usually files the user did not author, which
 * makes the missing name worse here than anywhere else: the reader knows the
 * exact path and never said it.
 *
 * 1. Create a project whose tsconfig is valid and whose `package.json` is not.
 * 2. Invoke `loadProjectPlugins` against that project.
 * 3. Assert the throw carries the `ttsc:` prefix and names the manifest.
 *
 * @evidence contracts/testing.md#behavioral-verification Malformed package discovery throws the ttsc parse prefix and the exact manifest path.
 * @evidence contracts/testing.md#independent-expectations The fixture path and malformed JSON are authored before loading, so the path diagnostic does not derive from a formatter or parser under test.
 * @evidence contracts/testing.md#distinguishing-cases A project whose tsconfig is valid and whose package.json is truncated must still fail discovery, with the ttsc parse prefix and the manifest path, so the valid tsconfig cannot mask the broken manifest.
 * @evidence contracts/testing.md#execution-ownership This source unit calls loadProjectPlugins directly on a project whose package.json is malformed, before any descriptor evaluation or native build.
 */
export const test_loadprojectplugins_names_the_package_manifest_that_failed_to_parse =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const manifest = path.join(root, "package.json");
    fs.writeFileSync(manifest, `{ "name": "broken", \n`, "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true } }),
      "utf8",
    );

    assert.throws(
      () =>
        loadProjectPlugins({
          binary: "",
          tsconfig: path.join(root, "tsconfig.json"),
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /^ttsc: failed to parse /);
        assert.equal(
          message.includes(manifest),
          true,
          `the message must name the broken manifest: ${message}`,
        );
        return true;
      },
    );
  };

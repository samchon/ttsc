import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";

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

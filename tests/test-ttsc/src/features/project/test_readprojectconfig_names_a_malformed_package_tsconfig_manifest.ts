import { TestProject } from "@ttsc/testing";

import { assert, fs, path, readProjectConfig } from "../../internal/project";

/**
 * Verifies a malformed preset manifest is reported instead of silently ignored.
 *
 * The `package.json#tsconfig` lookup discarded every failure and returned
 * `undefined`, so a broken preset manifest produced neither a value nor a
 * message about itself: resolution fell through to Node's entrypoint resolver
 * and the user met `Cannot find module 'example-preset.json'`, which names a
 * file that was never the problem. Node parses the manifest while resolving
 * into the package, so the failure arrives as `ERR_INVALID_PACKAGE_CONFIG`
 * before ttsc's own read is reached. The sibling of
 * `test_readprojectconfig_resolves_package_tsconfig_extends_via_manifest`,
 * which pins the healthy path.
 *
 * 1. Create `node_modules/example-preset` whose `package.json` is malformed.
 * 2. Write a project tsconfig that extends the bare `"example-preset"`.
 * 3. Assert the throw names that manifest in ttsc's own voice, and not the
 *    misleading `example-preset.json` fallback.
 */
export const test_readprojectconfig_names_a_malformed_package_tsconfig_manifest =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const preset = path.join(root, "node_modules", "example-preset");
    const project = path.join(root, "project");
    fs.mkdirSync(preset, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    const manifest = path.join(preset, "package.json");
    fs.writeFileSync(
      manifest,
      `{ "name": "example-preset", "tsconfig": "base.json"\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(preset, "base.json"),
      JSON.stringify({ compilerOptions: {} }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({ extends: "example-preset" }),
      "utf8",
    );

    assert.throws(
      () =>
        readProjectConfig({ tsconfig: path.join(project, "tsconfig.json") }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /^ttsc: failed to parse /);
        assert.equal(
          message.includes(manifest),
          true,
          `the message must name the broken manifest: ${message}`,
        );
        assert.equal(
          message.includes("example-preset.json"),
          false,
          `the message must not name the resolver fallback: ${message}`,
        );
        return true;
      },
    );
  };

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx --no-plugins skips ttsc plugin discovery and loading.
 *
 * Ttsc's own config loaders evaluate a user `*.config.ts` by running it through
 * ttsx in an ephemeral, deliberately lenient project. That build must NOT load
 * the host project's transform/check plugins: their factories run and their
 * project checks fire, so a plugin that imposes a requirement the loader
 * tsconfig does not meet (e.g. `@nestia/core` demanding `strict` mode) would
 * abort config evaluation. `--no-plugins` routes `false` into
 * `loadProjectPlugins`, which skips both `compilerOptions.plugins` entries and
 * package auto-discovery, making the build hermetic.
 *
 * 1. Materialize a project whose tsconfig declares a plugin entry whose
 *    `transform` specifier cannot be resolved.
 * 2. Run plain `ttsx` and assert it fails because plugin loading throws.
 * 3. Run `ttsx --no-plugins` and assert it succeeds and runs the entry.
 */
export const test_ttsx_no_plugins_skips_plugin_loading = () => {
  const root = TestProject.tmpdir("ttsc-ttsx-no-plugins-");
  for (const [name, contents] of Object.entries({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/this-plugin-does-not-exist" }],
      },
      include: ["src"],
    }),
    "src/main.ts": `console.log("ran");\n`,
  })) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }

  // Plain run: loadProjectPlugins resolves the tsconfig plugin entry and
  // throws because the `transform` specifier does not resolve.
  const withPlugins = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
    cwd: root,
  });
  assert.notEqual(
    withPlugins.status,
    0,
    "ttsx without --no-plugins should fail while loading the bogus plugin",
  );

  // Hermetic run: --no-plugins disables discovery, so the unresolvable
  // entry is never touched and the entry executes.
  const noPlugins = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--no-plugins", "src/main.ts"],
    { cwd: root },
  );
  assert.equal(noPlugins.status, 0, noPlugins.stderr);
  assert.equal(noPlugins.stdout.trim(), "ran");
};

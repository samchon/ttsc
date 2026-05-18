import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey ignores Go compiler install path when content
 * matches.
 *
 * Pnpm can materialize the same bundled Go executable through different
 * project-local virtual-store paths. The source-plugin cache key must follow
 * the compiler content, not the install path, so independent pnpm installs can
 * share the global binary cache.
 *
 * 1. Create one source plugin and two fake Go executables with identical content
 *    in different directories.
 * 2. Compute the cache key with each executable path.
 * 3. Assert the keys match.
 */
export const test_computecachekey_ignores_go_compiler_install_path_when_content_matches =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    const goA = path.join(root, "a", "go");
    const goB = path.join(root, "b", "go");
    fs.mkdirSync(path.dirname(goA), { recursive: true });
    fs.mkdirSync(path.dirname(goB), { recursive: true });
    fs.writeFileSync(goA, "same go compiler\n", "utf8");
    fs.writeFileSync(goB, "same go compiler\n", "utf8");

    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: goA,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: goB,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.equal(first, second);
  };

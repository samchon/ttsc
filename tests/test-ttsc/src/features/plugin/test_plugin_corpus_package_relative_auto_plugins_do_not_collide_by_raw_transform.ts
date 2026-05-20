import { TestProject } from "@ttsc/testing";

import {
  assert,
  commonJsProject,
  copyDirectory,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
  writeRelativePackagePlugin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: package-relative auto plugins do not collide by raw
 * transform path.
 *
 * Auto-discovered plugins from multiple packages may each resolve to a
 * different absolute path even though their `transform` strings look similar.
 * The deduplication key must be the resolved package identity, not the raw
 * `transform` string, so two separate auto-plugin packages both run rather than
 * one silently shadowing the other.
 *
 * 1. Set up two fake packages (`plugin-a`, `plugin-b`) as symlinked node_modules
 *    entries; each contributes a different prefix/suffix operation.
 * 2. Run ttsc with `--emit` against the project that lists both as dependencies.
 * 3. Assert zero exit and the emitted JS contains `"A:plugin:B"`, confirming both
 *    plugins ran in order.
 */
export const test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform =
  () => {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "plugin-a": "0.1.0",
          "plugin-b": "0.1.0",
        },
      }),
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );
    writeRelativePackagePlugin(root, "plugin-a", {
      name: "prefix",
      prefix: "A:",
    });
    writeRelativePackagePlugin(root, "plugin-b", {
      name: "suffix",
      suffix: ":B",
    });

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-package-relative-plugins-"),
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"A:plugin:B"/);
  };

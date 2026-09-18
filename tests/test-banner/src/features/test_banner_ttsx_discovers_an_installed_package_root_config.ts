import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestBanner } from "../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: ttsx discovers an installed package's
 * `banner.config.*` when it compiles that package's root at run time.
 *
 * A root no build covered is compiled through a tsconfig ttsx synthesizes to
 * inherit the owning project's options and plugins. For an installed package
 * that tsconfig lives in ttsx's private cache, and a native plugin discovers
 * its config files from the directory of the tsconfig it compiles, so the build
 * has to anchor that discovery at the package's own directory, as a bundler
 * adapter's temporary overlay does. The banner is a comment the program cannot
 * see, so the entry reads the root's JavaScript from the run's dependency
 * cache, which the runtime manifest names.
 *
 * 1. Install a package whose tsconfig enables `@ttsc/banner`, with a
 *    `banner.config.cjs` beside it and a `main` outside its `include`.
 * 2. Run a consumer entry that requires the package, then reads the root's
 *    JavaScript from the dependency cache.
 * 3. Assert that JavaScript carries the package's banner.
 */
export const test_banner_ttsx_discovers_an_installed_package_root_config =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "consumer", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => any;`,
        `declare const process: { env: Record<string, string | undefined> };`,
        `const fs = require("node:fs");`,
        `const path = require("node:path");`,
        `const value: string = require("banner-pkg").value;`,
        `const manifest = JSON.parse(`,
        `  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST, "utf8"),`,
        `);`,
        `const files: string[] = fs.readdirSync(manifest.depCacheDir, {`,
        `  recursive: true,`,
        `});`,
        `const bannered = files`,
        `  .filter((file) => file.endsWith("index.js"))`,
        `  .some((file) =>`,
        `    fs`,
        `      .readFileSync(path.join(manifest.depCacheDir, file), "utf8")`,
        `      .includes("package root banner"),`,
        `  );`,
        `console.log(value + " bannered=" + bannered);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/banner-pkg/package.json": JSON.stringify({
        name: "banner-pkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/banner-pkg/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          types: [],
          plugins: [{ transform: "@ttsc/banner" }],
        },
        include: ["src"],
      }),
      "node_modules/banner-pkg/banner.config.cjs": `module.exports = { text: "package root banner" };\n`,
      "node_modules/banner-pkg/src/inside.ts": `export const inside: string = "inside";\n`,
      "node_modules/banner-pkg/index.ts": `export const value: string = "root-ran";\n`,
    });
    TestBanner.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          PATH: TestBanner.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "root-ran bannered=true");
  };

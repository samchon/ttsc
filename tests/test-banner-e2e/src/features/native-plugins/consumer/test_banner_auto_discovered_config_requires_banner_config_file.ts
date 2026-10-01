import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: auto-discovered banner fails when no config
 * file exists.
 *
 * The auto-discovery path in the banner plugin requires a `banner.config.*`
 * file to be present in the project root. Without it the plugin must fail with
 * a clear diagnostic naming the expected file glob, so users know exactly what
 * to create — a silent success or a cryptic Go panic would be worse.
 *
 * 1. Create a CommonJS project whose `package.json` lists `@ttsc/banner` as a
 *    dependency (triggers auto-discovery), but omit any `banner.config.*`
 *    file.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert non-zero exit and a stderr message referencing the config file glob.
 *
 * @evidence contracts/testing.md#behavioral-verification Dependency discovery without banner.config must fail and name the accepted config glob.
 * @evidence contracts/testing.md#independent-expectations The banner contract requires text from a dedicated config rather than silent default output.
 * @evidence contracts/testing.md#distinguishing-cases Absent config is the negative discovery case; package_auto_discovers_config_file owns the present-config control.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_auto_discovered_config_requires_banner_config_file entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Absent configuration must traverse package discovery and report the descriptor failure through the launcher.
 * @evidence contracts/e2e.md#shared-execution The absent-file input conflicts with configured success fixtures, requiring its own descriptor load; the shared native producer still builds before the missing configuration fails inside its host. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Dependency discovery without banner.config must fail and name the accepted config glob. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_auto_discovered_config_requires_banner_config_file() {
    const root = TestProject.commonJsProject({
      "src/main.ts": `export const value = "banner";\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@ttsc/banner": "*" } }),
    );
    TestBanner.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestBanner.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /banner\.config\.\{ts,cts,mts,js,cjs,mjs,json\}/,
    );
}

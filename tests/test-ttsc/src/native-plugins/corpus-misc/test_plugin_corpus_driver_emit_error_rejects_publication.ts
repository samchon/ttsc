import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies a native host checking only Go errors rejects declaration failure.
 *
 * Legacy native hosts print emit diagnostics and publish pending outputs after
 * a nil Go error. TS4094 must now stop that path, including manifest
 * publication, with the host name, phase, severity and compiler code in the
 * error.
 *
 * 1. Copy the driver emit fixture and introduce a declaration-only error.
 * 2. Run the real ttsc source-plugin build with noEmitOnError on and off.
 * 3. Assert failure status, useful diagnostics and no output directory or
 *    manifest.
 */
export const test_plugin_corpus_driver_emit_error_rejects_publication = () => {
  const cacheDir = TestProject.tmpdir("ttsc-driver-emit-error-cache-");
  for (const noEmitOnError of [false, true]) {
    const root = copyProject("go-driver-emit-plugin");
    const configPath = path.join(root, "tsconfig.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.compilerOptions.noEmitOnError = noEmitOnError;
    fs.writeFileSync(configPath, JSON.stringify(config));
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      "export const value = class { private hidden = 1; };\n",
    );
    const manifest = path.join(root, "manifest.json");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /go-driver-emit-plugin: emit failed/);
    assert.match(result.stderr, /native plugin .* failed/);
    assert.match(result.stderr, /error/);
    assert.match(result.stderr, /TS4094/);
    assert.match(result.stderr, /declaration output is incomplete or skipped/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
    assert.equal(fs.existsSync(manifest), false);
  }
};

import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin selects the Go toolchain and Go build cache from
 * `opts.env`, not the ambient `process.env`.
 *
 * `opts.env` is the effective instance environment a programmatic
 * `TtscCompiler` builds with (`{ ...process.env, ...context.env }`). The Go
 * executable (`TTSC_GO_BINARY`) and the external Go build cache
 * (`TTSC_GO_CACHE_DIR`) must be read from that environment so two compiler
 * instances can pin isolated toolchains/caches without mutating the shared
 * `process.env`. This is the control-flow proof of RA-07: without the `env`
 * parameter these readers fall back to `process.env` and the injected values
 * are lost.
 *
 * Transformation direction with a negative twin: the fake toolchain and the
 * external Go cache are supplied ONLY in `opts.env`, while `process.env` holds
 * contradictory values (a non-existent Go binary and a different
 * `TTSC_GO_CACHE_DIR`). A build that reads `process.env` would fail on the
 * missing binary or capture the wrong cache; the build must instead succeed
 * through the `opts.env` toolchain and record the `opts.env` cache.
 *
 * 1. Point `opts.env.TTSC_GO_BINARY` at the fake Go and `process.env` at a
 *    non-existent path; point `opts.env.TTSC_GO_CACHE_DIR` at an external cache
 *    and `process.env.TTSC_GO_CACHE_DIR` at a contradictory directory.
 * 2. Build the plugin and capture the environment `go build` received.
 * 3. Assert the build succeeded through the `opts.env` toolchain and that the
 *    captured `GOCACHE` is the `opts.env` external cache.
 */
export const test_buildsourceplugin_selects_toolchain_and_go_cache_from_opts_env =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    writePluginSource(plugin);
    const cacheDir = path.join(root, "cache");
    const externalGoCache = path.join(root, "instance-go-cache");
    const contradictoryGoCache = path.join(root, "ambient-go-cache");
    const capture = path.join(root, "go-env.json");
    const fakeGo = createFakeGoBinary(root);

    const previous = {
      go: process.env.TTSC_GO_BINARY,
      goCache: process.env.GOCACHE,
      ttscGoCache: process.env.TTSC_GO_CACHE_DIR,
      capture: process.env.FAKE_GO_CAPTURE_ENV_FILE,
    };
    // Ambient values contradict the instance environment: a Go binary that does
    // not exist and a different external Go cache. Only reading `opts.env` can
    // build successfully and capture `externalGoCache`.
    process.env.TTSC_GO_BINARY = path.join(root, "does-not-exist-go");
    process.env.TTSC_GO_CACHE_DIR = contradictoryGoCache;
    delete process.env.GOCACHE;
    delete process.env.FAKE_GO_CAPTURE_ENV_FILE;
    try {
      buildSourcePlugin({
        baseDir: root,
        cacheDir,
        env: {
          ...process.env,
          TTSC_GO_BINARY: fakeGo,
          TTSC_GO_CACHE_DIR: externalGoCache,
          FAKE_GO_CAPTURE_ENV_FILE: capture,
        },
        overlayDirs: [],
        pluginName: "opts-env-toolchain",
        source: plugin,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      const captured = JSON.parse(fs.readFileSync(capture, "utf8")) as {
        GOCACHE: string | null;
      };
      assert.equal(captured.GOCACHE, externalGoCache);
    } finally {
      restore("TTSC_GO_BINARY", previous.go);
      restore("GOCACHE", previous.goCache);
      restore("TTSC_GO_CACHE_DIR", previous.ttscGoCache);
      restore("FAKE_GO_CAPTURE_ENV_FILE", previous.capture);
    }
  };

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function writePluginSource(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(root, "main.go"), "package main\n", "utf8");
  for (const file of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "package main\n", "utf8");
  }
}

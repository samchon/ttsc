import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/src/TtscCompiler";

/**
 * Verifies TtscCompiler.clean removes the instance's `context.env`-injected
 * external Go build cache while preserving a user `GOCACHE`.
 *
 * `clean()` must derive its removal targets from the same effective environment
 * (`{ ...process.env, ...context.env }`) that `prepare()`/`compile()` build
 * with, so a `TTSC_GO_CACHE_DIR` supplied only in `context.env` is owned and
 * removed by that instance. A `GOCACHE` value is the caller's broader Go
 * toolchain cache and must never be removed. Reading the ambient `process.env`
 * instead — which never held `TTSC_GO_CACHE_DIR` here — would leave the
 * instance's external cache behind.
 *
 * Transformation direction with a negative twin: the ttsc-owned external cache
 * arrives only through `context.env.TTSC_GO_CACHE_DIR` (ambient unset), and the
 * user cache arrives through `context.env.GOCACHE`. Clean must remove the
 * former and keep the latter, without setting `TTSC_GO_CACHE_DIR` on the shared
 * `process.env`.
 *
 * 1. Seed a project-local plugin cache, an external `TTSC_GO_CACHE_DIR`, and a
 *    user `GOCACHE`, with `TTSC_GO_CACHE_DIR` absent from `process.env`.
 * 2. Run `clean()` on an instance whose `context.env` carries both Go caches.
 * 3. Assert the plugin cache and external Go cache are removed, the user `GOCACHE`
 *    survives, and `process.env.TTSC_GO_CACHE_DIR` is still unset.
 *
 * The cache selector rows distinguish absent ambient state, inherited ambient
 * selection, an own undefined overlay and an explicit instance path. Independent
 * sentinels require every unselected cache and the authored source to survive.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscCompiler.clean removes instance-selected plugin and external Go caches while preserving user GOCACHE and ambient environment. Explicit cacheDir and relative environment cache rows assert their exact removed lists, absent selected targets and unchanged authored source bytes.
 * @evidence contracts/testing.md#independent-expectations TTSC_GO_CACHE_DIR is compiler-owned and GOCACHE is caller-owned; independently seeded roots make accidental deletion observable. Explicit selectors keep requested spellings; relative project caches use independently observed Node realpaths captured before deletion, including aliased temporary parents.
 * @evidence contracts/testing.md#distinguishing-cases Absent, inherited, own-undefined and explicit environment selectors delete only the selected seeded plugin cache; every unselected sentinel survives. Relative plugin cache and external owned Go cache are removed while a separate user Go cache remains; the effective instance environment differs from ambient state. Explicit cacheDir removes the whole selected root despite a conflicting environment selection; relative .cache/ttsc removes only plugins and owned local go-build, preserving the parent/root/source and user cache. No prepare result or build provenance is asserted.
 * @evidence contracts/testing.md#execution-ownership A unit test calling TtscCompiler.clean in process on seeded directories under os.tmpdir(); it runs no prepare, compile, native build or host, and ambient TTSC_CACHE_DIR and TTSC_GO_CACHE_DIR are saved and restored around the call.
 */
export function test_ttsccompiler_clean_removes_context_env_external_go_cache() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-clean-context-unit-"),
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true }),
  );
  fs.writeFileSync(path.join(root, "tsconfig.json"), "{}");
  const source = path.join(root, "main.ts");
  fs.writeFileSync(source, "export const value = 42;\n");
  const pluginCache = path.join(root, ".cache", "ttsc", "plugins");
  const externalGoCache = path.join(root, "instance-go-cache");
  const userGoCache = path.join(root, "user-go-cache");
  for (const target of [pluginCache, externalGoCache, userGoCache]) {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "seed"), "cache\n", "utf8");
  }

  const previousTtscGoCache = process.env.TTSC_GO_CACHE_DIR;
  const previousCache = process.env.TTSC_CACHE_DIR;
  const previousUserGoCache = process.env.GOCACHE;
  delete process.env.TTSC_GO_CACHE_DIR;
  try {
    const compiler = new TtscCompiler({
      cwd: root,
      env: {
        TTSC_CACHE_DIR: ".cache/ttsc",
        TTSC_GO_CACHE_DIR: externalGoCache,
        GOCACHE: userGoCache,
      },
    });

    const removed = compiler.clean();

    assert.equal(removed.includes(externalGoCache), true);
    assert.equal(fs.existsSync(externalGoCache), false);
    assert.equal(fs.existsSync(pluginCache), false);
    assert.equal(fs.existsSync(userGoCache), true);
    assert.equal(
      fs.readFileSync(path.join(userGoCache, "seed"), "utf8"),
      "cache\n",
    );
    // The fix must not lean on mutating the shared process environment.
    assert.equal(process.env.TTSC_GO_CACHE_DIR, undefined);
    const explicitCache = path.join(root, ".cache", "explicit");
    const unselectedCache = path.join(root, ".cache", "unselected");
    for (const target of [explicitCache, unselectedCache]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "seed"), "owned cache input\n");
    }
    assert.deepEqual(
      new TtscCompiler({
        cwd: root,
        cacheDir: explicitCache,
        env: {
          TTSC_CACHE_DIR: unselectedCache,
          TTSC_GO_CACHE_DIR: undefined,
          GOCACHE: userGoCache,
        },
      }).clean(),
      [explicitCache],
    );
    assert.equal(fs.existsSync(explicitCache), false);
    assert.equal(
      fs.readFileSync(path.join(unselectedCache, "seed"), "utf8"),
      "owned cache input\n",
    );
    assert.equal(fs.readFileSync(source, "utf8"), "export const value = 42;\n");

    const localGoCache = path.join(root, ".cache", "ttsc", "go-build");
    for (const target of [pluginCache, localGoCache]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "seed"), "owned local input\n");
    }
    const physicalPluginCache = fs.realpathSync(pluginCache);
    const physicalLocalGoCache = fs.realpathSync(localGoCache);
    assert.deepEqual(
      new TtscCompiler({
        cwd: root,
        env: {
          TTSC_CACHE_DIR: ".cache/ttsc",
          TTSC_GO_CACHE_DIR: undefined,
          GOCACHE: userGoCache,
        },
      }).clean(),
      [physicalPluginCache, physicalLocalGoCache],
    );
    assert.equal(fs.existsSync(pluginCache), false);
    assert.equal(fs.existsSync(localGoCache), false);
    assert.equal(fs.existsSync(path.join(root, ".cache", "ttsc")), true);
    assert.equal(fs.existsSync(root), true);
    assert.equal(fs.readFileSync(source, "utf8"), "export const value = 42;\n");
    assert.equal(
      fs.readFileSync(path.join(userGoCache, "seed"), "utf8"),
      "cache\n",
    );
    const ambientGoCache = path.join(root, "ambient-go-cache");
    fs.mkdirSync(ambientGoCache);
    fs.writeFileSync(path.join(ambientGoCache, "sentinel"), "ambient Go cache must survive\n");
    process.env.TTSC_GO_CACHE_DIR = ambientGoCache;
    for (const selection of ["absent", "inherited", "removed", "explicit"] as const) {
      const project = path.join(root, selection);
      fs.mkdirSync(project, { recursive: true });
      fs.writeFileSync(path.join(project, "package.json"), '{"private":true}');
      fs.writeFileSync(path.join(project, "tsconfig.json"), "{}");
      const authored = path.join(project, "main.ts");
      fs.writeFileSync(authored, "export const intact = 42;\n");
      const defaults = path.join(project, "node_modules/.cache/ttsc");
      const ambient = path.join(project, "ambient-cache");
      const explicit = path.join(project, "explicit-cache");
      for (const cache of [defaults, ambient, explicit]) {
        fs.mkdirSync(path.join(cache, "plugins"), { recursive: true });
        fs.writeFileSync(path.join(cache, "plugins", "sentinel"), "preserve unselected\n");
      }
      if (selection === "absent") delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = ambient;
      const overlay: NodeJS.ProcessEnv = {
        TTSC_GO_CACHE_DIR: undefined,
        GOCACHE: userGoCache,
      };
      if (selection === "removed") overlay.TTSC_CACHE_DIR = undefined;
      if (selection === "explicit") overlay.TTSC_CACHE_DIR = explicit;
      const selected = selection === "inherited" ? ambient
        : selection === "explicit" ? explicit : defaults;
      new TtscCompiler({ cwd: project, env: overlay }).clean();
      for (const cache of [defaults, ambient, explicit]) {
        const sentinel = path.join(cache, "plugins", "sentinel");
        assert.equal(fs.existsSync(sentinel), cache !== selected, selection + ": " + cache);
        if (cache !== selected)
          assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve unselected\n");
      }
      assert.equal(fs.readFileSync(authored, "utf8"), "export const intact = 42;\n");
      assert.equal(fs.readFileSync(path.join(userGoCache, "seed"), "utf8"), "cache\n");
      assert.equal(process.env.TTSC_CACHE_DIR, selection === "absent" ? undefined : ambient);
      assert.equal(fs.readFileSync(path.join(ambientGoCache, "sentinel"), "utf8"), "ambient Go cache must survive\n");
    }
    if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = previousCache;
    assert.equal(process.env.TTSC_CACHE_DIR, previousCache);
    assert.equal(process.env.GOCACHE, previousUserGoCache);
    assert.equal(process.env.TTSC_GO_CACHE_DIR, ambientGoCache);
  } finally {
    if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = previousCache;
    if (previousTtscGoCache === undefined) delete process.env.TTSC_GO_CACHE_DIR;
    else process.env.TTSC_GO_CACHE_DIR = previousTtscGoCache;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

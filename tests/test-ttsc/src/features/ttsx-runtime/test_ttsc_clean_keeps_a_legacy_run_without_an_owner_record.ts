import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runtimeRunsDirectory } from "../../internal/ttsx-run";

/**
 * Verifies default clean keeps a prior release's run with no owner record.
 *
 * An older ttsx process can still use its runtime output while a newer clean
 * runs. It records no owner and does not share the new lock, so absence of a
 * record cannot prove the run ended. Explicit cache removal remains available
 * when the caller knows every run has stopped.
 *
 * 1. Seed a legacy run directory without an owner record.
 * 2. Run default clean and assert it reports the kept directory without saying no
 *    cache directories were found.
 * 3. Remove the named cache explicitly and assert the directory goes.
 */
export const test_ttsc_clean_keeps_a_legacy_run_without_an_owner_record =
  (): void => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "legacy-run", private: true }),
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export const value = 1;\n",
    });
    const runs = runtimeRunsDirectory(root);
    const directory = path.join(runs, "legacy");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "main.js"), "", "utf8");
    // Default clean also removes old machine-global caches. Confine every such
    // path to this case, so the no-cache assertion cannot depend on or remove
    // a developer's global cache.
    const home = path.join(root, "clean-process-home");
    const temporary = path.join(home, "tmp");
    fs.mkdirSync(temporary, { recursive: true });
    const env = {
      HOME: home,
      USERPROFILE: home,
      LOCALAPPDATA: path.join(home, "AppData", "Local"),
      XDG_CACHE_HOME: path.join(home, "xdg"),
      TMPDIR: temporary,
      TEMP: temporary,
      TMP: temporary,
    };

    const ordinary = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["clean", "--cwd", root],
      { cwd: root, env },
    );
    assert.equal(ordinary.status, 0, ordinary.stderr);
    assert.equal(fs.existsSync(directory), true, ordinary.stdout);
    assert.match(ordinary.stdout, /ttsc: kept /);
    assert.doesNotMatch(ordinary.stdout, /no cache directories found/);

    const cacheRoot = path.dirname(path.dirname(runs));
    const explicit = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["clean", "--cwd", root, "--cache-dir", cacheRoot],
      { cwd: root, env },
    );
    assert.equal(explicit.status, 0, explicit.stderr);
    assert.equal(fs.existsSync(directory), false);
  };

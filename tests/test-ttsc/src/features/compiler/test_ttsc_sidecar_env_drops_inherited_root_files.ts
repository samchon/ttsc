import assert from "node:assert/strict";

import { ROOT_FILES_ENV } from "../../../../../packages/ttsc/lib/compiler/internal/sharedHost/ROOT_FILES_ENV.js";
import { clearInheritedRootFiles } from "../../../../../packages/ttsc/lib/compiler/internal/sharedHost/clearInheritedRootFiles.js";
import { inheritedSidecarEnv } from "../../../../../packages/ttsc/lib/compiler/internal/sharedHost/inheritedSidecarEnv.js";

/**
 * Verifies a sidecar environment drops root files it did not publish.
 *
 * A ttsx root build hands the file it runs to every native host through
 * `TTSC_ROOT_FILES`, and `driver.LoadProgram` replaces the project's file list
 * with it. A host can start another ttsc run in turn, such as `@ttsc/lint`
 * evaluating a config file through `ttsx`, and that run compiles projects of
 * its own. An inherited list would replace their files with the outer run's
 * root, so every spawn that publishes none clears it, the rule the forwarded
 * tsgo argv already follows. A caller that named the variable itself still
 * wins.
 *
 * 1. Clear an inherited list no caller named, directly and through
 *    `inheritedSidecarEnv`.
 * 2. Keep a list the caller named explicitly.
 * 3. Leave an environment that carries no list untouched.
 */
export const test_ttsc_sidecar_env_drops_inherited_root_files = (): void => {
  const previous = process.env[ROOT_FILES_ENV];
  const outer = JSON.stringify(["/outer/scripts/run.ts"]);

  const inherited: NodeJS.ProcessEnv = {
    PATH: "/usr/bin",
    [ROOT_FILES_ENV]: outer,
  };
  clearInheritedRootFiles(inherited, undefined);
  assert.equal(inherited[ROOT_FILES_ENV], undefined);
  assert.equal(inherited.PATH, "/usr/bin");

  process.env[ROOT_FILES_ENV] = outer;
  try {
    assert.equal(inheritedSidecarEnv(undefined)[ROOT_FILES_ENV], undefined);
    const inner = JSON.stringify(["/inner/scripts/run.ts"]);
    assert.equal(
      inheritedSidecarEnv({ [ROOT_FILES_ENV]: inner })[ROOT_FILES_ENV],
      inner,
    );
  } finally {
    if (previous === undefined) delete process.env[ROOT_FILES_ENV];
    else process.env[ROOT_FILES_ENV] = previous;
  }

  const declared: NodeJS.ProcessEnv = { [ROOT_FILES_ENV]: outer };
  clearInheritedRootFiles(declared, { [ROOT_FILES_ENV]: outer });
  assert.equal(declared[ROOT_FILES_ENV], outer);

  const absent: NodeJS.ProcessEnv = { PATH: "/usr/bin" };
  clearInheritedRootFiles(absent, undefined);
  assert.deepEqual(absent, { PATH: "/usr/bin" });
};

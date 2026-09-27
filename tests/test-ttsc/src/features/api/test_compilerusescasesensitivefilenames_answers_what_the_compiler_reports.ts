import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import {
  TtscCompiler,
  assert,
  createProject,
  path,
} from "../../internal/compiler";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsc answers the compiler's case policy before the compiler runs,
 * with the answer the compiler then reports, whatever `process.platform` says.
 *
 * Hosts that decide project membership before any compile, the Metro key, the
 * unplugin selection of a referenced project, and its first walk, took the case
 * policy from `process.platform === "linux"`. TypeScript-Go takes it from the
 * executable it runs as (samchon/ttsc#1563).
 * `compilerUsesCaseSensitiveFileNames` applies that rule to the plugin cache
 * root the executable lives in.
 *
 * 1. Transform a project through the compiler host in one cache root, and read the
 *    case policy its graph reports.
 * 2. Ask the helper for the same project and root.
 * 3. Ask it again, for a sibling root on the same volume, while `process.platform`
 *    names a platform whose ordinary answer is the other one.
 * 4. Assert all three agree.
 */
export const test_compilerusescasesensitivefilenames_answers_what_the_compiler_reports =
  (): void => {
    const root = createProject();
    const result = new TtscCompiler({
      cacheDir: SHARED_PLUGIN_CACHE_DIR,
      cwd: root,
    }).transform();
    assert.equal(result.type, "success");
    const reported = result.graph?.useCaseSensitiveFileNames;
    assert.equal(typeof reported, "boolean", "the compiler reported no policy");

    assert.equal(
      compilerUsesCaseSensitiveFileNames({
        cacheDir: SHARED_PLUGIN_CACHE_DIR,
        projectRoot: root,
      }),
      reported,
    );

    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", {
      ...platform,
      value: process.platform === "linux" ? "darwin" : "linux",
    });
    let answer: boolean;
    try {
      answer = compilerUsesCaseSensitiveFileNames({
        cacheDir: path.join(root, "sibling-cache"),
        projectRoot: root,
      });
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
    assert.equal(answer, reported, "the answer followed process.platform");
  };

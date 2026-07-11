import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  THROWER_THROW_COLUMN,
  THROWER_THROW_LINE,
  tallCommentThrowerSource,
} from "../../internal/ttsx-source-map";

/**
 * Verifies a thrown error's stack frame reports the true source line:col and
 * the real absolute source path for an entry-project file (issue #353).
 *
 * Ttsx runs emitted JavaScript under the `.ts` URL, so an unmapped frame
 * carries the `.ts` filename with emitted-JS line numbers (off by the
 * comment/prologue shift), and a consumed-but-mis-rooted map prints a
 * nonexistent path. The serve path now inlines an absolutized map and the
 * runtime bootstrap enables source maps, so the frame maps back to the exact
 * source position at the real path — with no `--enable-source-maps` flag from
 * the user.
 *
 * 1. Build an entry project whose `boom.ts` throws behind a tall comment.
 * 2. Run the entry (which calls `boom`) through ttsx.
 * 3. Assert a non-zero exit and a `boom (<real boom.ts>:12:9)` frame in stderr.
 */
export const test_ttsx_stack_trace_maps_to_the_true_source_position_for_the_entry_project =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          sourceMap: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/boom.ts": tallCommentThrowerSource("boom", "entry boom"),
      "src/main.ts": ['import { boom } from "./boom";', "boom();", ""].join(
        "\n",
      ),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0, "the thrown error must fail the run");
    const real = fs.realpathSync(path.join(root, "src", "boom.ts"));
    assertMappedFrame(result.stderr, "boom", real);
  };

/** Assert stderr carries a `<fn> (<file>:LINE:COL)` frame at the true position. */
function assertMappedFrame(stderr: string, fn: string, file: string): void {
  const frame = `${fn} (${file}:${THROWER_THROW_LINE}:${THROWER_THROW_COLUMN})`;
  assert.ok(
    fold(stderr).includes(fold(frame)),
    `stderr must contain the mapped frame "${frame}"\n---\n${stderr}`,
  );
}

function fold(value: string): string {
  const slashed = value.replace(/\\/g, "/");
  return process.platform === "win32" ? slashed.toLowerCase() : slashed;
}

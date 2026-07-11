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
 * Verifies stack frames map to the true source position even when the entry
 * tsconfig emits no map (`sourceMap: false`), via the forced runtime map.
 *
 * A project that publishes without maps must still get correct ttsx stacks.
 * ttsx forces a map on its private runtime emit and enables source maps in the
 * child, so the frame maps regardless of the owning tsconfig — pinning the
 * forced-map path together with the stack test that uses it.
 *
 * 1. Build an entry project with `sourceMap: false` whose `boom.ts` throws behind
 *    a tall comment.
 * 2. Run the entry through ttsx.
 * 3. Assert a non-zero exit and a `boom (<real boom.ts>:12:9)` frame in stderr.
 */
export const test_ttsx_stack_trace_maps_to_the_true_source_position_when_the_entry_emits_no_map =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          sourceMap: false,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/boom.ts": tallCommentThrowerSource("boom", "no-map boom"),
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

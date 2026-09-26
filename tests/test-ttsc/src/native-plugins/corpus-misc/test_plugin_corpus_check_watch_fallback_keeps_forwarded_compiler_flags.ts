import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../internal/plugin-corpus";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies a watch cycle whose resident check host died still checks with the
 * compiler flags the user forwarded.
 *
 * A resident check host receives the forwarded tsgo flags through
 * `TTSC_TSGO_ARGS` when it starts. When a request to it fails, the cycle falls
 * back to the one-shot check command, which omitted that payload, so its
 * environment constructor cleared the variable and the recovery cycle checked a
 * different program than the user asked for: `--noImplicitAny` vanished and its
 * diagnostic with it.
 *
 * 1. Start `ttsc --noEmit --watch --noImplicitAny` on a non-strict lint project
 *    whose source has an implicitly typed parameter.
 * 2. Record the healthy resident cycle's TS7006.
 * 3. Kill the resident host and edit the source so the next cycle falls back.
 * 4. Assert the fallback cycle reports TS7006 again.
 */
export const test_plugin_corpus_check_watch_fallback_keeps_forwarded_compiler_flags =
  async (): Promise<void> => {
    const root = setupLintProject("lint-violations");
    const tsconfig = path.join(root, "tsconfig.json");
    const config = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
      compilerOptions: Record<string, unknown>;
    };
    config.compilerOptions.strict = false;
    fs.writeFileSync(tsconfig, JSON.stringify(config), "utf8");
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({ rules: {} }),
    );
    const source = path.join(root, "src", "main.ts");
    fs.writeFileSync(
      source,
      "export function echo(value) {\n  return value;\n}\n",
    );

    const session = new WatchSession(root, {
      args: ["--noEmit", "--diagnostics", "--noImplicitAny"],
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    try {
      await session.waitForBuilds(1, 300_000);
      const healthy = session.transcript();
      assert.equal(countTs7006(healthy), 1, healthy);
      const pid = Number(
        /@ttsc\/lint resident check: pid=(\d+)/.exec(healthy)?.[1],
      );
      assert.ok(Number.isInteger(pid), healthy);

      process.kill(pid);
      fs.appendFileSync(source, "// edited after the resident host died\n");
      await session.waitForBuilds(2);
      const recovered = session.transcript();
      assert.equal(
        countTs7006(recovered),
        2,
        `the fallback cycle must keep --noImplicitAny:\n${recovered}`,
      );
    } finally {
      await session.close();
    }
  };

function countTs7006(transcript: string): number {
  return transcript.match(/TS7006/g)?.length ?? 0;
}

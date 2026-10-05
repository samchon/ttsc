import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/src/TtscCompiler";
import { TestProject } from "../../../../utils/src/TestProject";
import { withCapturedTtscCacheCommand } from "../../internal/withCapturedTtscCacheCommand";

/**
 * Exercise clean's actual source dispatcher, effects and returned report text.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct runTtsc default clean preserves missing/malformed ownership records, returns status zero and writes exact kept lines; explicit cache selection removes both runs. Actual TtscCompiler.clean additionally reports and removes an empty runtime tree.
 * @evidence contracts/testing.md#independent-expectations Authored directory paths, empty legacy main.js and malformed owner bytes define independent protected inputs; exact kept strings, absence after explicit selection and empty-tree removal distinguish preservation from deletion.
 * @evidence contracts/testing.md#distinguishing-cases Default conservative cleanup contrasts with explicit whole-cache authorization; an empty runtime tree is independently removable. No dead process, acquired dead lock or simultaneous waiting-run lifecycle is fabricated or covered.
 * @evidence contracts/testing.md#execution-ownership One source-unit entry calls runTtsc and TtscCompiler over an owned workspace. Synchronous stdout/stderr capture and ambient environment inputs restore in finally, with native migration roots checked inside the fixture before effects. No compiler, launcher process or worker is started by this test; delegated native path-identity observations are not a zero-native-process guarantee. CLI process bootstrap/exit transport remains separate.
 */
export function test_runtime_clean_handler_preserves_unknown_runs_and_removes_explicit_cache(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("clean-handler-owned-"),
  );
  const cache = path.join(root, "node_modules", ".cache", "ttsc");
  const runtime = path.join(cache, "ttsx");
  const runs = path.join(runtime, "project");
  const legacy = path.join(runs, "legacy");
  const unknown = path.join(runs, "unknown");
  TestProject.writeFiles(root, {
    "package.json":
      '{"name":"legacy-run","private":true,"workspaces":["packages/*"]}',
    "tsconfig.json": '{"include":["src"]}',
    "src/main.ts": "export {};\n",
  });
  const failures: unknown[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "main.js"), "", "utf8");
    fs.mkdirSync(unknown);
    fs.writeFileSync(path.join(unknown, "owner-12.json"), "{", "utf8");
    const ordinary = withCapturedTtscCacheCommand(root, [
      "clean",
      "--cwd",
      root,
    ]);
    check("default status", () =>
      assert.equal(ordinary.status, 0, ordinary.stderr),
    );
    check("legacy kept", () => assert.equal(fs.existsSync(legacy), true));
    check("malformed kept", () => assert.equal(fs.existsSync(unknown), true));
    check("legacy bytes", () =>
      assert.equal(fs.readFileSync(path.join(legacy, "main.js"), "utf8"), ""),
    );
    check("malformed bytes", () =>
      assert.equal(
        fs.readFileSync(path.join(unknown, "owner-12.json"), "utf8"),
        "{",
      ),
    );
    for (const directory of [legacy, unknown])
      check("kept report/" + path.basename(directory), () =>
        assert.ok(
          ordinary.stdout
            .split(/\r?\n/)
            .includes(
              `ttsc: kept ${path.relative(root, directory)}: a run that may still be in progress owns it`,
            ),
          ordinary.stdout,
        ),
      );
    check("not empty report", () =>
      assert.doesNotMatch(ordinary.stdout, /no cache directories found/),
    );
    const explicit = withCapturedTtscCacheCommand(root, [
      "clean",
      "--cwd",
      root,
      "--cache-dir",
      cache,
    ]);
    check("explicit status", () =>
      assert.equal(explicit.status, 0, explicit.stderr),
    );
    check("explicit legacy gone", () =>
      assert.equal(fs.existsSync(legacy), false),
    );
    check("explicit malformed gone", () =>
      assert.equal(fs.existsSync(unknown), false),
    );
    fs.mkdirSync(runs, { recursive: true });
    const spellings = [
      runtime,
      fs.realpathSync(runtime),
      fs.realpathSync.native(runtime),
    ];
    const removed = new TtscCompiler({
      cwd: root,
      env: { TTSC_CACHE_DIR: cache, TTSC_GO_CACHE_DIR: "", GOCACHE: "" },
    }).clean();
    check("empty runtime API report", () =>
      assert.ok(removed.some((entry) => spellings.includes(entry))),
    );
    check("empty runtime API absence", () =>
      assert.equal(fs.existsSync(runtime), false),
    );
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Owned clean handler assertions failed");
}

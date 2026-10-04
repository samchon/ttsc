import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runTtsc } from "../../../../packages/ttsc/src/launcher/internal/runTtsc";
import { legacyGlobalCacheTargets } from "../../../../packages/ttsc/src/plugin/internal/source/legacyGlobalCacheTargets";

/** Capture one synchronous source dispatcher call with fixture-owned cache inputs. */
export function withCapturedTtscCacheCommand(root: string, argv: readonly string[]) {
  const home = path.join(root, "clean-process-home");
  const temporary = path.join(home, "tmp");
  fs.mkdirSync(temporary, { recursive: true });
  const environment: Record<string, string> = {
    HOME: home,
    USERPROFILE: home,
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
    XDG_CACHE_HOME: path.join(home, "xdg"),
    TMPDIR: temporary,
    TEMP: temporary,
    TMP: temporary,
    TTSC_CACHE_DIR: "",
    TTSC_GO_CACHE_DIR: "",
    GOCACHE: "",
  };
  const previous = Object.entries(environment).map(([requested, next]) => {
    const existing = Object.keys(process.env).find((name) =>
      process.platform === "win32" ? name.toUpperCase() === requested.toUpperCase() : name === requested,
    );
    const name = existing ?? requested;
    return { name, next, present: existing !== undefined, value: process.env[name] };
  });
  const writeOut = process.stdout.write;
  const writeError = process.stderr.write;
  let stdout = "";
  let stderr = "";
  try {
    for (const record of previous) process.env[record.name] = record.next;
    // No cleanup call can reach a migration root outside this owned fixture.
    for (const target of legacyGlobalCacheTargets()) {
      const relative = path.relative(root, target);
      assert.ok(relative !== "" && !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep), target);
    }
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stderr.write;
    return { status: runTtsc(argv), get stdout() { return stdout; }, get stderr() { return stderr; } };
  } finally {
    process.stdout.write = writeOut;
    process.stderr.write = writeError;
    for (const record of previous) {
      if (record.present && record.value !== undefined) process.env[record.name] = record.value;
      else delete process.env[record.name];
    }
  }
}

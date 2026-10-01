import { TestUnpluginRuntime } from "@ttsc/testing";
import { type ChildProcess, spawn } from "node:child_process";

/**
 * Transform one module in a separate process that belongs to the pooled host
 * session `session`, the way a Turbopack or Metro worker does
 * (samchon/ttsc#1390).
 *
 * The process builds its own transform cache, declares it shared through the
 * session it inherits, and transforms `file` once. It answers with the
 * transformed code, `null` for an unchanged module, or the error it hit.
 * `killed` is true when the process ended without an answer, as a worker the
 * host killed does, and `error` then carries what it wrote to stderr. `onSpawn`
 * receives the process, so a scenario can kill it mid-compile.
 */
export function runPooledWorker(props: {
  file: string;
  onSpawn?: (child: ChildProcess) => void;
  options?: Record<string, unknown>;
  session: string;
}): Promise<{ code?: string | null; error?: string; killed: boolean }> {
  const script = [
    `const api = await import(${JSON.stringify(TestUnpluginRuntime.libUrl("api"))});`,
    'const fs = await import("node:fs");',
    "const [file, options] = JSON.parse(process.argv[1]);",
    "const cache = api.createTtscTransformCache();",
    "api.shareTtscTransformCache(cache, api.readTtscTransformSession());",
    "try {",
    '  const result = await api.transformTtsc(file, fs.readFileSync(file, "utf8"), api.resolveOptions(options), undefined, cache);',
    "  process.stdout.write(JSON.stringify({ code: result?.code ?? null }));",
    "} catch (error) {",
    "  process.stdout.write(JSON.stringify({ error: String(error?.stack ?? error) }));",
    "}",
  ].join("\n");
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      script,
      JSON.stringify([props.file, props.options ?? {}]),
    ],
    {
      env: { ...process.env, TTSC_UNPLUGIN_TRANSFORM_SESSION: props.session },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  props.onSpawn?.(child);
  let stdout = "";
  let stderr = "";
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (status, signal) => {
      if (signal !== null || (status !== 0 && stdout === "")) {
        resolve({ error: stderr, killed: signal !== null || status !== 0 });
        return;
      }
      try {
        resolve({ ...JSON.parse(stdout), killed: false });
      } catch {
        reject(new Error(`worker printed no result: ${stdout}\n${stderr}`));
      }
    });
  });
}

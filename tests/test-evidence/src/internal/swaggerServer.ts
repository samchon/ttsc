import { type ChildProcess, spawn } from "node:child_process";

/**
 * Starts the real loopback Swagger server and records its exact-query requests.
 *
 * A separate process must serve requests while runCheck blocks the parent event
 * loop. Readiness waits for a complete port line; request observation remains
 * attached through actual child closure so synchronous checks cannot lose it.
 *
 * @evidence contracts/common.md#principled-implementation A real HTTP child accepts only the literal query-bearing path and returns the authored OpenAPI document. A complete newline-delimited valid port establishes readiness; actual request lines establish fetching independently of the compiler verdict.
 * @evidence contracts/common.md#clear-and-simple-design The starter returns child, URL and observed request array; the caller owns final stop and assertions. Failed startup or cancellation joins that same child before rethrowing, preserving both startup and termination errors.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No HTTP or compiler method is replaced; process argv and child output carry the real boundary. Kill requests alone never establish released ownership.
 * @evidence contracts/common.md#meaningful-documentation Explains why the server must live outside the synchronous parent and why complete readiness and post-close request observation are necessary.
 * @evidence contracts/portability.md#os-neutral-implementation Node executable plus argv and loopback listen use native abstractions without a shell or fixed port; supported child signals are requested through Node.
 * @evidence contracts/performance.md#efficient-algorithms Output processing scans each completed line once, retaining only incomplete text plus observed requests; authored document serialization happens once per server.
 * @evidence contracts/performance.md#reuse-equivalent-work One server and document serve the query reference throughout the owning consumer lifetime; no requests reuse a fabricated response.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller retains one child and a request array until close; startup listeners and timeout are removed on settlement. Weak maps do not retain released children, and stop joins process/stdio close with bounded force/deadline timers. Request count is not capped.
 */
export const startSwaggerServer = async (
  signal?: AbortSignal,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{
  child: ChildProcess;
  url: string;
  requests: readonly string[];
}> => {
  const document: string = JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Members", version: "1.0.0" },
    paths: {
      "/members/{id}": {
        get: {
          operationId: "members.get",
          responses: { 200: { description: "Found" } },
        },
      },
    },
  });
  const script: string = [
    'const http = require("node:http");',
    `const document = ${JSON.stringify(document)};`,
    "const server = http.createServer((request, response) => {",
    '  if (request.url !== "/openapi.json?revision=1") {',
    "    response.writeHead(404);",
    "    response.end();",
    "    return;",
    "  }",
    '  response.writeHead(200, { "content-type": "application/json" });',
    '  process.stdout.write("request:" + request.url + "\\n");',
    "  response.end(document);",
    "});",
    'server.listen(0, "127.0.0.1", () => {',
    '  process.stdout.write(String(server.address().port) + "\\n");',
    "});",
    'process.on("SIGTERM", () => server.close(() => process.exit(0)));',
    "",
  ].join("\n");
  const child: ChildProcess = spawn(process.execPath, ["-e", script], {
    stdio: ["ignore", "pipe", "pipe"],
    env: environment,
  });
  child.on("error", (error: Error) => swaggerServerErrors.set(child, error));
  swaggerServerClosures.set(
    child,
    new Promise<void>((resolve) => child.once("close", () => resolve())),
  );
  const requests: string[] = [];
  let transcript = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    transcript += chunk;
    const lines = transcript.split(/\r?\n/u);
    transcript = lines.pop() ?? "";
    for (const line of lines) if (line.startsWith("request:")) requests.push(line.slice(8));
  });
  let port: number;
  try {
    port = await new Promise<number>((resolve, reject) => {
      let stdout = "";
      const cleanup = (): void => {
        clearTimeout(timeout);
        child.stdout?.removeListener("data", onData);
        child.removeListener("error", onError);
        child.removeListener("exit", onExit);
        signal?.removeEventListener("abort", onAbort);
      };
      const onData = (chunk: string): void => {
        stdout += chunk;
        if (!stdout.includes("\n")) return;
        const line = stdout.split(/\r?\n/u)[0];
        if (line === undefined || /^\d+$/u.test(line) === false) return;
        const value = Number(line);
        if (!Number.isInteger(value) || value < 1 || value > 65_535) return;
        cleanup();
        resolve(value);
      };
      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };
      const onExit = (code: number | null): void => {
        cleanup();
        reject(new Error(
          `Swagger fixture server exited before listening (status ${String(code)}).`,
        ));
      };
      const onAbort = (): void => {
        cleanup();
        reject(signal?.reason ?? new Error("Swagger fixture server startup aborted."));
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while starting the Swagger fixture server."));
      }, 10_000);
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", onData);
      child.once("error", onError);
      child.once("exit", onExit);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  } catch (error) {
    try {
      await stopSwaggerServer(child);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Swagger startup and cleanup failed.");
    }
    throw error;
  }
  return {
    child,
    requests,
    url: `http://127.0.0.1:${port}/openapi.json?revision=1`,
  };
};

/** The owner records close at spawn, including an exit before readiness. */
const swaggerServerClosures = new WeakMap<ChildProcess, Promise<void>>();
const swaggerServerErrors = new WeakMap<ChildProcess, Error>();

/**
 * Terminates the fixture server and joins its actual process/stdio closure.
 *
 * @evidence contracts/common.md#principled-implementation Success requires the spawn-time close promise rather than a successful signal request; recorded spawn failures remain observable after closure.
 * @evidence contracts/common.md#clear-and-simple-design One stop operation owns its force and deadline timers, while the starter owns the persistent close observation. Every completion removes this operation's timers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A bounded forced kill is followed by actual close; deadline expiry reports failure instead of treating a still-live child as released.
 * @evidence contracts/common.md#meaningful-documentation Distinguishes requested termination from joined process and stdio ownership.
 */
export const stopSwaggerServer = async (child: ChildProcess): Promise<void> => {
  const closed = swaggerServerClosures.get(child);
  if (closed === undefined)
    throw new Error("The Swagger fixture server has no close owner.");
  let force: NodeJS.Timeout | undefined;
  let deadline: NodeJS.Timeout | undefined;
  let rejectTermination!: (error: unknown) => void;
  const terminationFailure = new Promise<never>((_, reject) => {
    rejectTermination = reject;
    deadline = setTimeout(() => {
      reject(new Error("The Swagger fixture server did not close after termination."));
    }, 20_000);
  });
  try {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      force = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null)
          try {
            child.kill("SIGKILL");
          } catch (error) {
            rejectTermination(error);
          }
      }, 10_000);
    }
    await Promise.race([closed, terminationFailure]);
    const error = swaggerServerErrors.get(child);
    if (error !== undefined) throw error;
  } finally {
    if (force !== undefined) clearTimeout(force);
    if (deadline !== undefined) clearTimeout(deadline);
  }
};

import {
  assert,
  child_process,
  nativeBinary,
  tsgoBinary,
  ttscBin,
} from "./toolchain";

/** A real `ttsc --watch` child with build-count and quiet-period assertions. */
export class WatchSession {
  private readonly child: ReturnType<typeof child_process.spawn>;
  private readonly listeners = new Set<() => void>();
  private builds = 0;
  private output = "";

  public constructor(
    root: string,
    options: { args?: readonly string[]; env?: NodeJS.ProcessEnv } = {},
  ) {
    const child = child_process.spawn(
      process.execPath,
      [ttscBin, ...(options.args ?? []), "--watch", "--cwd", root],
      {
        cwd: root,
        env: {
          ...process.env,
          ...options.env,
          TTSC_BINARY: nativeBinary,
          TTSC_TSGO_BINARY: tsgoBinary,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const { stderr, stdout } = child;
    if (stdout === null || stderr === null) {
      child.kill();
      throw new Error("ttsc --watch must expose piped stdout and stderr");
    }
    this.child = child;
    const onChunk = (chunk: Buffer): void => {
      this.output += chunk.toString("utf8");
      this.builds = (
        this.output.match(/\[ttsc\] watch build (?:complete|failed)/g) ?? []
      ).length;
      for (const listener of this.listeners) listener();
    };
    stdout.on("data", onChunk);
    stderr.on("data", onChunk);
  }

  /** Wait until at least `count` build completions have been observed. */
  public waitForBuilds(count: number, timeout = 120_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.listeners.delete(check);
        resolve();
      };
      const timer = setTimeout(() => {
        this.listeners.delete(check);
        reject(
          new Error(
            `ttsc --watch did not reach ${count} builds:\n${this.output}`,
          ),
        );
      }, timeout);
      const check = (): void => {
        if (this.builds >= count) finish();
      };
      this.listeners.add(check);
      check();
    });
  }

  /** Assert that no additional build lands during a deliberate idle period. */
  public waitForQuiet(duration = 900): Promise<void> {
    const initial = this.builds;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(check);
        resolve();
      }, duration);
      const check = (): void => {
        if (this.builds === initial) return;
        clearTimeout(timer);
        this.listeners.delete(check);
        reject(
          new Error(
            `ttsc --watch rebuilt during an idle period:\n${this.output}`,
          ),
        );
      };
      this.listeners.add(check);
    });
  }

  /** Return the combined stdout/stderr transcript observed so far. */
  public transcript(): string {
    return this.output;
  }

  /** Stop the child and fail if its persistent watcher handles do not drain. */
  public async close(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      this.assertNoUncaughtExit();
      return;
    }
    const exited = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.child.kill("SIGKILL");
        reject(new Error(`ttsc --watch did not exit:\n${this.output}`));
      }, 30_000);
      this.child.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
      this.child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    this.child.kill("SIGTERM");
    await exited;
    this.assertNoUncaughtExit();
  }

  private assertNoUncaughtExit(): void {
    assert.equal(
      /Uncaught|UnhandledPromiseRejection/.test(this.output),
      false,
      `ttsc --watch must terminate without an uncaught error:\n${this.output}`,
    );
  }
}

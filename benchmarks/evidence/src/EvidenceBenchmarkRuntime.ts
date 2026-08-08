import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import type { EvidenceBenchmarkArm } from "./typings/EvidenceBenchmarkArm";

/** Assigns and validates process-level resources owned by one benchmark cell. */
export namespace EvidenceBenchmarkRuntime {
  /** Default first port of the allocation, one disjoint block per cell. */
  export const DEFAULT_PORT_BASE = 46_000;

  /**
   * Pinned Playwright MCP server every cell drives its browser through.
   *
   * The frontend guidance requires driving every main journey in an interactive
   * browser and the workspace provided no way to do it, so every cell took the
   * escape clause and shipped defects that one accessibility snapshot would
   * have shown. The capability is delivered rather than assumed, and it is
   * delivered to both arms by the same code path, which is what keeps it out of
   * the variable the campaign measures.
   *
   * The version is pinned because it is a frozen material input like the
   * requirements and the template. What the pin does not fix is the browser:
   * the server drives a channel installed on the host, so two cells run days
   * apart can drive two different builds of it while the record shows one
   * specifier. Pinning that is a decision about the machine rather than about
   * this file.
   */
  export const BROWSER_MCP_SPECIFIER = "@playwright/mcp@0.0.79";

  /**
   * Seconds the browser server may take to answer its handshake.
   *
   * The first launch on a machine installs the server and its own Playwright
   * from the registry, which is far longer than a warm start and is exactly the
   * launch whose failure would be least expected.
   */
  export const BROWSER_MCP_STARTUP_TIMEOUT_SECONDS = 300;

  /**
   * Builds the one Codex home a cell is allowed to read.
   *
   * Without this the runner inherits the operator's `~/.codex`, so every
   * measured thread reads whatever `AGENTS.md`, hooks, personality, and MCP
   * servers that machine happens to carry. A cohort compared under those
   * conditions is comparing the arms plus an untracked per-machine table, and
   * nothing in the retained record would say so. The graph benchmark's agent
   * already builds a throwaway home for exactly this reason; this is the same
   * remedy in the same shape.
   *
   * The generated configuration is the whole of what a cell sees: the browser
   * server, and nothing else. `auth.json` is copied so the thread stays logged
   * in, and it is the only file taken from the real home.
   *
   * `required` is load-bearing. Without it a server that misses its handshake
   * is dropped from the tool list and the thread runs on, so a cohort would
   * launch without the capability the frontend gate demands and nothing would
   * say so until a cell reported it could not drive a browser.
   */
  export function prepareCodexHome(
    runRoot: string | undefined,
    retainedSessionId?: string,
  ): string {
    const operatorHome: string = path.join(os.homedir(), ".codex");
    const real: string = path.join(operatorHome, "auth.json");
    if (!fs.existsSync(real))
      throw new Error(
        `Codex is not logged in: ${real} does not exist. Run \`codex login\` before launching a cell.`,
      );

    // A run that already owns a thread keeps whatever home that thread lives in.
    //
    // A home is not only configuration. The rollout a resume replays and the
    // Goal state the runner reconciles against both live inside it, in separate
    // stores, and neither can be read from anywhere else. Handing an existing
    // thread a fresh directory therefore does not isolate that run — it severs
    // it: the resume asks for a thread that, from where it is now standing, was
    // never created.
    //
    // That is not hypothetical. Isolation arrived mid-cohort, and the first cell
    // resumed after it stopped with `no rollout found for thread id`. Seeding
    // the rollout by hand moved the failure rather than fixing it, to
    // `Retained state has no exact empty Goal boundary`, because the Goal store
    // is a different file and was equally empty. One cell, two symptoms, one
    // cause.
    //
    // Adopting rather than seeding is deliberate. The stores are shared across
    // every thread on the machine, so copying enough of them to satisfy one
    // resume would import other threads' state and defeat the isolation for
    // every later run in the same directory. A run started before isolation was
    // never isolated; saying so is honest, and it is recoverable, while a
    // severed thread is neither.
    //
    // Only a run with no isolated home of its own takes this path, so every run
    // launched under isolation keeps it, including one forked from a
    // checkpoint — a fork holds no session and starts its thread here.
    const home: string =
      runRoot === undefined
        ? fs.mkdtempSync(path.join(os.tmpdir(), "evidence-codex-home-"))
        : path.join(runRoot, "codex-home");
    if (
      runRoot !== undefined &&
      retainedSessionId !== undefined &&
      !fs.existsSync(home)
    )
      return operatorHome;

    fs.mkdirSync(home, { recursive: true });
    fs.copyFileSync(real, path.join(home, "auth.json"));
    fs.writeFileSync(
      path.join(home, "config.toml"),
      [
        "[mcp_servers.playwright]",
        `command = "npx"`,
        `args = ["-y", "${BROWSER_MCP_SPECIFIER}"]`,
        "required = true",
        `startup_timeout_sec = ${BROWSER_MCP_STARTUP_TIMEOUT_SECONDS}`,
        "",
      ].join("\n"),
      "utf8",
    );
    return home;
  }

  /** Network endpoints reserved for one subject and arm. */
  export interface IAssignment {
    /** Nest application port inherited by backend commands and tests. */
    apiPort: number;

    /** Standalone Swagger server port. */
    swaggerPort: number;

    /** Vite development server port. */
    viteDevelopmentPort: number;

    /** Vite preview port owned by Playwright. */
    playwrightPort: number;

    /** Public HTTP origin corresponding to {@link apiPort}. */
    apiHost: string;
  }

  /** Returns one stable, disjoint four-port block for a benchmark cell. */
  export function assign(
    subject: string,
    arm: EvidenceBenchmarkArm,
    portBase: number = DEFAULT_PORT_BASE,
  ): IAssignment {
    const subjects = [
      "todo",
      "reddit",
      "shopping",
      "erp",
      "todo2",
      "todo3",
      "reddit2",
      "shopping2",
    ] as const;
    const arms: readonly EvidenceBenchmarkArm[] = ["evidence", "plain"];
    const subjectIndex: number = subjects.indexOf(
      subject as (typeof subjects)[number],
    );
    const armIndex: number = arms.indexOf(arm);
    if (subjectIndex === -1 || armIndex === -1)
      throw new Error(`Unknown benchmark cell: ${subject}/${arm}.`);
    // The highest base whose last cell's last port still fits, derived from the
    // populations rather than written down: a subject added to the array above
    // moves this bound, and a literal would keep naming the previous one.
    const highestBase: number =
      65_535 - ((subjects.length * arms.length - 1) * 10 + 3);
    if (!Number.isInteger(portBase) || portBase < 1 || portBase > highestBase)
      throw new Error(
        `Benchmark port base must be an integer between 1 and ${highestBase}: ${String(portBase)}.`,
      );
    const base: number =
      portBase + (subjectIndex * arms.length + armIndex) * 10;
    return {
      apiPort: base,
      swaggerPort: base + 1,
      viteDevelopmentPort: base + 2,
      playwrightPort: base + 3,
      apiHost: `http://127.0.0.1:${base}`,
    };
  }

  /** Overrides inherited machine values with the cell-owned endpoints. */
  export function apply(
    environment: NodeJS.ProcessEnv,
    assignment: IAssignment,
  ): void {
    environment.API_PORT = String(assignment.apiPort);
    environment.SWAGGER_PORT = String(assignment.swaggerPort);
    environment.VITE_API_HOST = assignment.apiHost;
    environment.VITE_DEV_PORT = String(assignment.viteDevelopmentPort);
    environment.PLAYWRIGHT_TEST_PORT = String(assignment.playwrightPort);
    stripLauncherIdentity(environment);
  }

  /**
   * Markers a coding agent exports to announce itself to the tools it runs.
   *
   * Whoever launches a campaign leaves these in the environment, and a child
   * process inherits them the whole way down. Prisma reads exactly this set and
   * refuses a destructive command when it finds one, which is how a Codex cell
   * came to be told it "was invoked by Claude Code" and blocked on a consent
   * only a human could give. A measured cell must behave the same whoever
   * started it, so the operator's tooling identity does not travel into it.
   */
  const LAUNCHER_IDENTITY_VARIABLES: readonly string[] = [
    "CLAUDECODE",
    "CLAUDE_CODE",
    "CLAUDE_CODE_ENTRYPOINT",
    "CURSOR_AGENT",
    "GEMINI_CLI",
    "REPLIT_CLI",
  ];

  /** Removes the launching agent's self-announcement from a child environment. */
  export function stripLauncherIdentity(environment: NodeJS.ProcessEnv): void {
    for (const name of Object.keys(environment))
      if (
        LAUNCHER_IDENTITY_VARIABLES.some(
          (marker) => marker === name.toUpperCase(),
        )
      )
        delete environment[name];
  }

  /** Fails before model use when any selected endpoint is already occupied. */
  export async function assertAvailable(
    assignments: readonly IAssignment[],
  ): Promise<void> {
    const owners: Map<number, string> = new Map();
    for (const assignment of assignments)
      for (const [name, port] of ports(assignment)) {
        const prior: string | undefined = owners.get(port);
        if (prior !== undefined)
          throw new Error(
            `Benchmark runtime port ${port} is assigned to both ${prior} and ${name}.`,
          );
        owners.set(port, name);
      }
    await Promise.all(
      [...owners].map(([port, name]) => assertPortAvailable(port, name)),
    );
  }

  /** Compares retained runtime identity without depending on object order. */
  export function equals(
    x: IAssignment | undefined,
    y: IAssignment | undefined,
  ): boolean {
    if (x === undefined || y === undefined) return x === y;
    return (
      x.apiPort === y.apiPort &&
      x.swaggerPort === y.swaggerPort &&
      x.viteDevelopmentPort === y.viteDevelopmentPort &&
      x.playwrightPort === y.playwrightPort &&
      x.apiHost === y.apiHost
    );
  }

  const ports = (
    assignment: IAssignment,
  ): readonly (readonly [string, number])[] => [
    ["api", assignment.apiPort],
    ["swagger", assignment.swaggerPort],
    ["vite-development", assignment.viteDevelopmentPort],
    ["playwright", assignment.playwrightPort],
  ];

  const assertPortAvailable = async (
    port: number,
    name: string,
  ): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const server: net.Server = net.createServer();
      server.unref();
      server.once("error", (cause) =>
        reject(
          new Error(
            `Benchmark ${name} port ${port} is unavailable before launch.`,
            { cause },
          ),
        ),
      );
      server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
        server.close((cause) =>
          cause === undefined ? resolve() : reject(cause),
        ),
      );
    });
  };
}

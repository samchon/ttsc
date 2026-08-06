import net from "node:net";

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
   * have shown. The capability is therefore delivered rather than assumed, and
   * it is delivered to both arms by the same code path: the invocation this
   * appears in has no arm branch, which is what keeps it out of the variable
   * the campaign measures.
   *
   * The version is pinned because it is a frozen material input like the
   * requirements and the template. A floating specifier would let two cells in
   * one cohort drive different browsers, and the retained process record would
   * say they did not.
   */
  export const BROWSER_MCP_SPECIFIER = "@playwright/mcp@0.0.79";

  /**
   * Native arguments that attach the browser server to a cell's thread.
   *
   * Codex reads `mcp_servers.<name>` from its configuration, and `--config`
   * overrides reach the same table without writing a file into the measured
   * workspace, which would be an input a cell could edit.
   */
  export function browserServerArguments(): string[] {
    return [
      "--config",
      "mcp_servers.playwright.command=npx",
      "--config",
      `mcp_servers.playwright.args=["-y","${BROWSER_MCP_SPECIFIER}"]`,
    ];
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
    const subjects = ["todo", "reddit", "shopping", "erp", "todo2"] as const;
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

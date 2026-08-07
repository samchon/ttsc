import { EvidenceBenchmarkRuntime } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkRuntime";

/**
 * Verifies the browser server is pinned, required, and given a startup window.
 *
 * The frontend gate demands driving every journey in an interactive browser, so
 * the capability has to arrive with the session rather than be assumed. Codex
 * drops a server that misses its handshake and runs the thread on, which would
 * launch a whole cohort without the browser while the retained record still
 * showed the arguments meant to attach it, so `required` is the load-bearing
 * one. The version is pinned because it is a frozen material input, and the
 * window is widened because the first launch on a machine installs the server
 * from the registry inside it.
 *
 * 1. Assert the pinned specifier is an exact version rather than a range.
 * 2. Assert the argument vector declares the command, the pinned args, the
 *    required flag, and the startup window, each as its own `--config` pair.
 * 3. Assert nothing in the vector names an arm.
 */
export const test_benchmark_runtime_attaches_the_browser_server_to_every_cell =
  (): void => {
    const specifier: string = EvidenceBenchmarkRuntime.BROWSER_MCP_SPECIFIER;
    if (/^@playwright\/mcp@\d+\.\d+\.\d+$/u.test(specifier) === false)
      throw new Error(
        `The browser server must be pinned to one exact version, not ${specifier}.`,
      );

    const args: readonly string[] =
      EvidenceBenchmarkRuntime.browserServerArguments();
    const pairs: string[] = args.filter((_, index) => index % 2 === 1);
    if (args.length !== pairs.length * 2)
      throw new Error("Every browser server argument must be a --config pair.");
    if (args.some((value, index) => index % 2 === 0 && value !== "--config"))
      throw new Error(
        `A browser server argument is not a --config: ${args.join(" ")}`,
      );

    const expected: readonly string[] = [
      "mcp_servers.playwright.command=npx",
      `mcp_servers.playwright.args=["-y","${specifier}"]`,
      "mcp_servers.playwright.required=true",
      `mcp_servers.playwright.startup_timeout_sec=${EvidenceBenchmarkRuntime.BROWSER_MCP_STARTUP_TIMEOUT_SECONDS}`,
    ];
    for (const value of expected)
      if (pairs.includes(value) === false)
        throw new Error(
          `The browser server is attached without ${value}: ${pairs.join(" ")}`,
        );

    // The capability is held constant, so nothing here may name an arm. A
    // browser one arm has and the other does not is confounded with the graph.
    if (/\b(?:plain|evidence)\b/iu.test(args.join(" ")))
      throw new Error(
        `The browser server arguments name an arm, which confounds the capability with the measured variable: ${args.join(" ")}`,
      );
  };

import { path, requireFromTest, workspaceRoot } from "./toolchain";

interface MarketplaceProbeResult {
  attempts: number;
  elapsedMs: number;
  extensionId: string;
  publisher: string;
  name: string;
  version: string;
  versions: string[];
}

interface MarketplaceQueryOptions {
  extensionId: string;
  version?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

interface MarketplaceWaitOptions extends MarketplaceQueryOptions {
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: { warn: (message: string) => void };
}

interface MarketplaceProbeModule {
  queryMarketplace(
    options: MarketplaceQueryOptions,
  ): Promise<Omit<MarketplaceProbeResult, "attempts" | "elapsedMs">>;
  waitForMarketplace(
    options: MarketplaceWaitOptions,
  ): Promise<MarketplaceProbeResult>;
}

const marketplaceProbe = requireFromTest(
  path.join(workspaceRoot, "scripts", "assert-marketplace-version.cjs"),
) as MarketplaceProbeModule;

const galleryPayload = (
  publisher: string,
  name: string,
  versions: string[],
) => ({
  results: [
    {
      extensions: [
        {
          extensionName: name,
          publisher: { publisherName: publisher },
          versions: versions.map((version) => ({ version })),
        },
      ],
    },
  ],
});

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const silentLogger = { warn: (_message: string) => undefined };

export { galleryPayload, jsonResponse, marketplaceProbe, silentLogger };

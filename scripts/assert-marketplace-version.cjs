// Public VS Code Marketplace release gate.
//
// `vsce publish` proves that the authenticated Gallery API accepted an upload;
// it does not prove that anonymous VS Code clients can discover the extension.
// This probe asks the same public exact-name endpoint used for install-by-id and
// fails closed until the extension, and optionally one exact version, is served.
//
// Usage:
//   node scripts/assert-marketplace-version.cjs \
//     --extension samchon.ttsc
//   node scripts/assert-marketplace-version.cjs \
//     --extension samchon.ttsc --version 0.19.4

const DEFAULT_ENDPOINT =
  "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 10 * 1000;
const EXTENSION_ID_PATTERN = /^([a-z0-9][a-z0-9-]*)\.([a-z0-9][a-z0-9-]*)$/i;

class MarketplaceProbeError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "MarketplaceProbeError";
    this.retryable = options.retryable === true;
  }
}

function parseExtensionId(extensionId) {
  if (typeof extensionId !== "string") {
    throw new MarketplaceProbeError(
      "marketplace-probe: --extension must be a string",
    );
  }
  const match = EXTENSION_ID_PATTERN.exec(extensionId);
  if (match === null) {
    throw new MarketplaceProbeError(
      `marketplace-probe: extension id ${JSON.stringify(extensionId)} must be exactly <publisher>.<name>`,
    );
  }
  return {
    extensionId,
    publisher: match[1],
    name: match[2],
  };
}

function marketplaceQueryBody(extensionId) {
  return JSON.stringify({
    filters: [
      {
        criteria: [{ filterType: 7, value: extensionId }],
        pageNumber: 1,
        pageSize: 5,
        sortBy: 0,
        sortOrder: 0,
      },
    ],
    assetTypes: [],
    // IncludeVersions without IncludeLatestVersionOnly. An already-served
    // historical version is valid after `vsce publish --skip-duplicate`, even
    // when a newer Marketplace version now exists.
    flags: 1,
  });
}

async function queryMarketplace(options) {
  const { extensionId, publisher, name } = parseExtensionId(
    options.extensionId,
  );
  if (
    options.version !== undefined &&
    (typeof options.version !== "string" || options.version.length === 0)
  ) {
    throw new MarketplaceProbeError(
      "marketplace-probe: version must be a non-empty string",
    );
  }
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new MarketplaceProbeError(
      "marketplace-probe: this Node.js runtime does not provide fetch",
    );
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json;api-version=7.2-preview.1",
        "Content-Type": "application/json",
        "User-Agent": "ttsc-release-marketplace-probe",
      },
      body: marketplaceQueryBody(extensionId),
      signal: options.signal,
    });
  } catch (cause) {
    throw new MarketplaceProbeError(
      `marketplace-probe: public Gallery request failed: ${errorMessage(cause)}`,
      { cause, retryable: true },
    );
  }

  if (
    response === null ||
    typeof response !== "object" ||
    typeof response.status !== "number"
  ) {
    throw new MarketplaceProbeError(
      "marketplace-probe: public Gallery returned a malformed HTTP response",
    );
  }
  if (response.status === 429 || response.status >= 500) {
    throw new MarketplaceProbeError(
      `marketplace-probe: public Gallery returned retryable HTTP ${response.status}`,
      { retryable: true },
    );
  }
  if (response.status < 200 || response.status >= 300) {
    throw new MarketplaceProbeError(
      `marketplace-probe: public Gallery returned HTTP ${response.status}`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new MarketplaceProbeError(
      `marketplace-probe: public Gallery returned malformed JSON: ${errorMessage(cause)}`,
      { cause },
    );
  }
  const extensions = readExtensions(payload);
  if (extensions.length === 0) {
    throw new MarketplaceProbeError(
      `marketplace-probe: ${extensionId} is not publicly served`,
      { retryable: true },
    );
  }

  const normalizedPublisher = publisher.toLowerCase();
  const normalizedName = name.toLowerCase();
  const exact = [];
  const unrelated = [];
  for (const extension of extensions) {
    if (
      extension === null ||
      typeof extension !== "object" ||
      typeof extension.extensionName !== "string" ||
      extension.publisher === null ||
      typeof extension.publisher !== "object" ||
      typeof extension.publisher.publisherName !== "string"
    ) {
      throw new MarketplaceProbeError(
        "marketplace-probe: public Gallery returned a malformed extension record",
      );
    }
    if (
      extension.publisher.publisherName.toLowerCase() === normalizedPublisher &&
      extension.extensionName.toLowerCase() === normalizedName
    ) {
      exact.push(extension);
    } else {
      unrelated.push(
        `${extension.publisher.publisherName}.${extension.extensionName}`,
      );
    }
  }
  if (unrelated.length !== 0) {
    throw new MarketplaceProbeError(
      `marketplace-probe: exact query for ${extensionId} returned unrelated extension(s): ${unrelated.join(", ")}`,
    );
  }
  if (exact.length !== 1) {
    throw new MarketplaceProbeError(
      `marketplace-probe: exact query for ${extensionId} returned ${exact.length} matching records`,
    );
  }

  const versions = exact[0].versions;
  if (!Array.isArray(versions)) {
    throw new MarketplaceProbeError(
      `marketplace-probe: ${extensionId} has no version list in the public Gallery response`,
    );
  }
  const versionNames = versions.map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof entry.version !== "string" ||
      entry.version.length === 0
    ) {
      throw new MarketplaceProbeError(
        `marketplace-probe: ${extensionId} has a malformed public version record`,
      );
    }
    return entry.version;
  });
  if (versionNames.length === 0) {
    throw new MarketplaceProbeError(
      `marketplace-probe: ${extensionId} is public but serves no versions`,
      { retryable: true },
    );
  }
  if (
    options.version !== undefined &&
    !versionNames.includes(options.version)
  ) {
    throw new MarketplaceProbeError(
      `marketplace-probe: ${extensionId} does not publicly serve version ${options.version} (served: ${versionNames.join(", ")})`,
      { retryable: true },
    );
  }

  return {
    extensionId,
    publisher: exact[0].publisher.publisherName,
    name: exact[0].extensionName,
    version: options.version ?? versionNames[0],
    versions: versionNames,
  };
}

function readExtensions(payload) {
  if (
    payload === null ||
    typeof payload !== "object" ||
    !Array.isArray(payload.results) ||
    payload.results.length !== 1 ||
    payload.results[0] === null ||
    typeof payload.results[0] !== "object" ||
    !Array.isArray(payload.results[0].extensions)
  ) {
    throw new MarketplaceProbeError(
      "marketplace-probe: public Gallery returned a malformed query result",
    );
  }
  return payload.results[0].extensions;
}

async function waitForMarketplace(options) {
  const timeoutMs = validateMilliseconds(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    "timeout",
    true,
  );
  const intervalMs = validateMilliseconds(
    options.intervalMs ?? DEFAULT_INTERVAL_MS,
    "interval",
    false,
  );
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const logger = options.logger ?? console;
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let attempts = 0;
  let lastError;

  while (true) {
    attempts += 1;
    const controller = new AbortController();
    const remaining = Math.max(1, deadline - now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const result = await queryMarketplace({
        ...options,
        signal: controller.signal,
      });
      return { ...result, attempts, elapsedMs: now() - startedAt };
    } catch (cause) {
      const error =
        cause instanceof MarketplaceProbeError
          ? cause
          : new MarketplaceProbeError(
              `marketplace-probe: unexpected failure: ${errorMessage(cause)}`,
              { cause },
            );
      if (!error.retryable) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }

    if (now() >= deadline) break;
    const delay = Math.min(intervalMs, deadline - now());
    logger.warn(
      `marketplace-probe: attempt ${attempts} pending; retrying in ${delay} ms: ${lastError.message}`,
    );
    await sleep(delay);
  }

  throw new MarketplaceProbeError(
    `marketplace-probe: ${options.extensionId}${options.version ? `@${options.version}` : ""} was not publicly served within ${timeoutMs} ms after ${attempts} attempt(s): ${lastError.message}`,
    { cause: lastError },
  );
}

function validateMilliseconds(value, label, allowZero) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new MarketplaceProbeError(
      `marketplace-probe: ${label} milliseconds must be ${allowZero ? "a non-negative" : "a positive"} safe integer`,
    );
  }
  return value;
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(argv) {
  const options = {
    extensionId: undefined,
    version: undefined,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    intervalMs: DEFAULT_INTERVAL_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--extension") {
      options.extensionId = argv[++i];
    } else if (arg.startsWith("--extension=")) {
      options.extensionId = arg.slice("--extension=".length);
    } else if (arg === "--version") {
      options.version = argv[++i];
    } else if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length);
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parseMilliseconds(argv[++i], "timeout");
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = parseMilliseconds(
        arg.slice("--timeout-ms=".length),
        "timeout",
      );
    } else if (arg === "--interval-ms") {
      options.intervalMs = parseMilliseconds(argv[++i], "interval");
    } else if (arg.startsWith("--interval-ms=")) {
      options.intervalMs = parseMilliseconds(
        arg.slice("--interval-ms=".length),
        "interval",
      );
    } else {
      throw new MarketplaceProbeError(
        `marketplace-probe: unknown argument ${JSON.stringify(arg)}`,
      );
    }
  }
  if (!options.extensionId) {
    throw new MarketplaceProbeError(
      "marketplace-probe: --extension is required",
    );
  }
  if (options.version !== undefined && options.version.length === 0) {
    throw new MarketplaceProbeError(
      "marketplace-probe: --version must not be empty",
    );
  }
  validateMilliseconds(options.timeoutMs, "timeout", true);
  validateMilliseconds(options.intervalMs, "interval", false);
  parseExtensionId(options.extensionId);
  return options;
}

function parseMilliseconds(value, label) {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new MarketplaceProbeError(
      `marketplace-probe: --${label}-ms requires an integer`,
    );
  }
  return Number(value);
}

async function main(argv) {
  const options = parseArgs(argv);
  const result = await waitForMarketplace(options);
  console.log(
    `marketplace-probe: OK — ${result.extensionId} publicly serves ${options.version ? `version ${result.version}` : `${result.versions.length} version(s), latest ${result.version}`}`,
  );
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(errorMessage(error));
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_ENDPOINT,
  DEFAULT_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  MarketplaceProbeError,
  main,
  marketplaceQueryBody,
  parseArgs,
  parseExtensionId,
  queryMarketplace,
  waitForMarketplace,
};

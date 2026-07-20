const BUILTIN_MODULES = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

/**
 * Extract the package name from a module specifier.
 *
 * Returns `null` for relative paths, hash imports, URL specifiers, and Node
 * built-in modules — the caller doesn't install those from npm.
 */
export function packageNameFromSpecifier(specifier: string): string | null {
  const nodePrefixed = specifier.startsWith("node:");
  const bare = nodePrefixed ? specifier.slice("node:".length) : specifier;
  const first = bare.split("/")[0];
  if (first && BUILTIN_MODULES.has(first)) return null;
  if (
    specifier.startsWith("#") ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(specifier)
  )
    return null;
  if (bare.startsWith("@")) {
    const firstSlash = bare.indexOf("/");
    if (firstSlash < 0) return null;
    if (firstSlash === 1) return null;
    const secondSlash = bare.indexOf("/", firstSlash + 1);
    if (secondSlash === firstSlash + 1) return null;
    return secondSlash < 0 ? bare : bare.slice(0, secondSlash);
  }
  const slash = bare.indexOf("/");
  return slash < 0 ? bare : bare.slice(0, slash);
}

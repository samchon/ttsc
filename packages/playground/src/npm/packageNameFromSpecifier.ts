const BUILTIN_MODULES = new Set([
  "assert",
  "buffer",
  "child_process",
  "console",
  "constants",
  "crypto",
  "dns",
  "events",
  "fs",
  "http",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "vm",
  "worker_threads",
  "zlib",
]);

/**
 * Extract the package name from a module specifier.
 *
 * Returns `null` for relative paths, hash imports, URL specifiers, and
 * Node built-in modules — the caller doesn't install those from npm.
 */
export function packageNameFromSpecifier(specifier: string): string | null {
  if (
    specifier.startsWith("#") ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(specifier)
  )
    return null;
  const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  const first = bare.split("/")[0];
  if (first && BUILTIN_MODULES.has(first)) return null;
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

import * as fs from "node:fs";
import * as path from "node:path";

/** Resolve the ttsc helper binary path, or null when unavailable. */
export function resolveBinary(
  opts: { env?: NodeJS.ProcessEnv } = {},
): string | null {
  const env = opts.env ?? process.env;
  if (env.TTSC_BINARY && path.isAbsolute(env.TTSC_BINARY)) {
    return env.TTSC_BINARY;
  }

  try {
    return require.resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/${process.platform === "win32" ? "ttsc.exe" : "ttsc"}`,
    );
  } catch {
    /* fall through */
  }

  const local = defaultLocalBinaryPath();
  if (local) return local;

  return null;
}

function defaultLocalBinaryPath(): string | null {
  const root = packageRootDir();
  const candidate = path.resolve(
    root,
    "..",
    "native",
    process.platform === "win32" ? "ttsc-native.exe" : "ttsc-native",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function packageRootDir(): string {
  const moduleDir = path.resolve(__dirname, "..", "..");
  return fs.realpathSync.native?.(moduleDir) ?? fs.realpathSync(moduleDir);
}

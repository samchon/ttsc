import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

export interface TsgoResolveOptions {
  /** Absolute path to an explicit tsgo-compatible binary. */
  binary?: string;
  /** Project directory used for node_modules resolution. */
  cwd?: string;
  /** Environment variables used for explicit binary overrides. */
  env?: NodeJS.ProcessEnv;
  /** Override process.platform for tests. */
  platform?: NodeJS.Platform;
  /** Override process.arch for tests. */
  arch?: string;
  /** Override package resolution for tests. */
  resolver?: (request: string) => string;
}

export interface ResolvedTsgo {
  binary: string;
  gitHead?: string;
  packageJson: string;
  packageRoot: string;
  platformPackageJson?: string;
  version: string;
}

export function nativePreviewPlatformPackage(
  opts: TsgoResolveOptions = {},
): string {
  return `@typescript/native-preview-${opts.platform ?? process.platform}-${
    opts.arch ?? process.arch
  }`;
}

export function resolveTsgo(opts: TsgoResolveOptions = {}): ResolvedTsgo {
  const env = opts.env ?? process.env;
  const explicit = opts.binary ?? env.TTSC_TSGO_BINARY;
  if (explicit) {
    if (!path.isAbsolute(explicit) || !fs.existsSync(explicit)) {
      throw new Error(
        `ttsc: explicit tsgo binary must be an existing absolute path: ${explicit}`,
      );
    }
    return {
      binary: explicit,
      packageJson: "",
      packageRoot: path.dirname(explicit),
      version: "custom",
    };
  }

  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const resolver =
    opts.resolver ??
    ((request: string) => createRequire(path.join(cwd, "package.json")).resolve(request));
  let packageJson: string;
  try {
    packageJson = resolver("@typescript/native-preview/package.json");
  } catch {
    throw new Error(
      [
        "ttsc: @typescript/native-preview is required.",
        "Install the TypeScript-Go preview in the consuming project:",
        "  npm i -D @typescript/native-preview",
      ].join("\n"),
    );
  }

  const manifest = readPackageJson(packageJson);
  const packageRoot = path.dirname(packageJson);
  const platformPackage = nativePreviewPlatformPackage(opts);
  const platformResolver = createRequire(packageJson);
  let platformPackageJson: string;
  try {
    platformPackageJson = platformResolver.resolve(`${platformPackage}/package.json`);
  } catch {
    throw new Error(
      [
        `ttsc: platform-specific TypeScript-Go binary not found (${platformPackage}).`,
        "Reinstall @typescript/native-preview with optional dependencies enabled.",
      ].join("\n"),
    );
  }

  const platformRoot = path.dirname(platformPackageJson);
  const binary = path.join(
    platformRoot,
    "lib",
    (opts.platform ?? process.platform) === "win32" ? "tsgo.exe" : "tsgo",
  );
  if (!fs.existsSync(binary)) {
    throw new Error(`ttsc: TypeScript-Go executable not found: ${binary}`);
  }
  return {
    binary,
    gitHead: typeof manifest.gitHead === "string" ? manifest.gitHead : undefined,
    packageJson,
    packageRoot,
    platformPackageJson,
    version: typeof manifest.version === "string" ? manifest.version : "unknown",
  };
}

function readPackageJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

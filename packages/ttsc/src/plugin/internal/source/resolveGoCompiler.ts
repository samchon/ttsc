import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * The Go compiler a plugin build runs, before the build's directory selects a
 * toolchain (`GoToolResolution.resolveGoToolForBuild`): `TTSC_GO_BINARY` when
 * set, the toolchain bundled with ttsc's platform package or a local native
 * build, `~/go-sdk`, and `go` on the path last.
 *
 * Both the build (`buildSourcePlugin`) and the environment a consumer proves
 * the build's output against (`pluginBuildEnvironment`) resolve the compiler
 * here, so they key on one toolchain (samchon/ttsc#1493).
 *
 * @param env The build's effective environment.
 * @returns The compiler, and whether it is the one ttsc bundles.
 */
export function resolveGoCompiler(env: NodeJS.ProcessEnv = process.env): {
  binary: string;
  bundled: boolean;
} {
  const explicit = env.TTSC_GO_BINARY;
  if (explicit && explicit.length > 0) {
    return { binary: explicit, bundled: false };
  }

  try {
    return {
      binary: createRequire(__filename).resolve(
        `@ttsc/${process.platform}-${process.arch}/bin/go/bin/${process.platform === "win32" ? "go.exe" : "go"}`,
      ),
      bundled: true,
    };
  } catch {
    /* fall through */
  }

  const platformPackage = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    `ttsc-${process.platform}-${process.arch}`,
    "bin",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(platformPackage)) {
    return { binary: platformPackage, bundled: true };
  }

  const local = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "native",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(local)) return { binary: local, bundled: true };

  const homeSdk = path.join(
    env.HOME ?? "",
    "go-sdk",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(homeSdk)) return { binary: homeSdk, bundled: false };

  return { binary: "go", bundled: false };
}

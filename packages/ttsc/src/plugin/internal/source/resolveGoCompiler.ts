import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { resolveNativePackagePath } from "../../../compiler/internal/project/resolveNativePackagePath";
import { resolvePhysicalProjectPath } from "../../../compiler/internal/project/resolvePhysicalProjectPath";
import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * The initial Go executable candidate before build-facing lookup applies the
 * module directory (`GoToolResolution.resolveGoToolForBuild`): TTSC_GO_BINARY
 * when set, the toolchain bundled with ttsc's platform package or a local
 * native build, `~/go-sdk`, and `go` on the path last.
 *
 * Both the build (`buildSourcePlugin`) and the environment a consumer proves
 * the build's output against (`pluginBuildEnvironment`) resolve the compiler
 * here. Nonexplicit layout candidates use resolution/existence checks, not
 * content or executable-kind validation; later lookup/permission/probe owners
 * handle that candidate. The bundled flag also covers mutable development SDKs
 * for permission handling. Only the installed platform package supplies a
 * package manifest for SDK identity.
 *
 * @param env The build's effective environment.
 * @returns The compiler, and whether it is the one ttsc bundles.
 * @evidence contracts/common.md#principled-implementation Selection follows explicit override, packaged/local SDK layout, home SDK and bare-name fallback precedence. The bundled-layout flag chooses the downstream permission policy, without certifying candidate kind, execute access or immutable ownership here.
 * @evidence contracts/common.md#clear-and-simple-design One resolver is shared by builds and environment proofs, with ordered early returns and executable resolution left to its separate owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Install layouts are product-defined fallbacks and the explicit environment belongs to the caller; no process global or foreign resolver is patched.
 * @evidence contracts/common.md#meaningful-documentation Native documentation explains precedence, bundled provenance and the later module-directory toolchain boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native package resolution selects the installed SDK. A lossless lexical witness prevents POSIX package aliases from selecting an executable at the decoded lookalike. Checkout identity uses native realpath bytes, and explicit and PATH choices keep their own resolution policy.
 * @evidence contracts/performance.md#efficient-algorithms A fixed candidate order has early returns but Node require resolution can search native module ancestors/manifests/paths. Native path/existence/home lookup and supplied text contribute cost; fixed candidate count is not a bounded filesystem-work claim and no SDK content traversal is performed here.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current caller overrides and installation presence are resolved afresh; this selector owns no memo.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Candidate paths and require resolution are call-local and acquire no retained native handle.
 */
export function resolveGoCompiler(env: NodeJS.ProcessEnv = process.env): {
  binary: string;
  bundled: boolean;
  packageManifest?: string;
} {
  const explicit = env.TTSC_GO_BINARY;
  if (explicit && explicit.length > 0) {
    return { binary: explicit, bundled: false };
  }

  const executable = process.platform === "win32" ? "go.exe" : "go";
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
    executable,
  );
  try {
    const binary = resolveNativePackagePath(
      createRequire(__filename),
      __filename,
      `@ttsc/${process.platform}-${process.arch}/bin/go/bin/${executable}`,
      "bundled Go executable",
    );
    if (process.platform !== "win32")
      resolvePhysicalProjectPath(binary, "bundled Go executable");
    const checkout = fs.existsSync(platformPackage)
      ? RuntimeFilesystem.realpathWitness(platformPackage)
      : undefined;
    if (binary === platformPackage || binary === checkout)
      return { binary, bundled: true };
    return {
      binary,
      bundled: true,
      packageManifest: path.resolve(binary, "../../../../package.json"),
    };
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException | null)?.code ===
      "TTSC_UNREPRESENTABLE_PROJECT_PATH"
    )
      throw error;
    /* fall through */
  }
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
    env.HOME || env.USERPROFILE || os.homedir(),
    "go-sdk",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(homeSdk)) return { binary: homeSdk, bundled: false };

  return { binary: "go", bundled: false };
}

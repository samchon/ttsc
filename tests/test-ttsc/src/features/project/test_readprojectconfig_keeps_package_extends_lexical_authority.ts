import { createRequire, registerHooks } from "node:module";

import { resolveNativePackagePath } from "../../../../../packages/ttsc/src/compiler/internal/project/resolveNativePackagePath";
import { RuntimeLoaderCapabilities } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeLoaderCapabilities";
import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies package config selection keeps the path Node used before realpath.
 *
 * 1. Resolve a package export using its native require condition.
 * 2. On Linux, retarget that export's file alias to a raw byte path.
 * 3. Require lossless qualification to refuse the alias under ordinary and
 *    hook-modified native conditions.
 *
 * @evidence contracts/testing.md#behavioral-verification Uses the normal project reader and Node package exports. Native require selects the declared condition and the lexical proof refuses the non-UTF-8 physical target before inherited options are read.
 * @evidence contracts/testing.md#independent-expectations The native byte target and its valid UTF-8 twin are separately authored. Explicit literals identify the intermediate export and valid result; a different fallback proves which condition selected the file.
 * @evidence contracts/testing.md#distinguishing-cases The ordinary export runs everywhere. Linux distinguishes a raw target from its equal-content UTF-8 twin, including when a supported local hook adds the selecting condition after the worker already ran. A resolver error supplied by a hook is preserved.
 * @evidence contracts/testing.md#execution-ownership The unit owns the package tree and all raw entries. The config reader owns its real Node resolver witness and no Go or compiler host runs.
 */
export function test_readprojectconfig_keeps_package_extends_lexical_authority(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-raw-preset-")),
  );
  const preset = path.join(root, "node_modules", "preset");
  const normal = path.join(preset, "ordinary.json");
  const alias = path.join(preset, "raw-primary.json");
  const twin = path.join(preset, "target-\ufffd.json");
  const raw = Buffer.concat([
    Buffer.from(`${preset}/target-`),
    Buffer.from([0xff]),
    Buffer.from(".json"),
  ]);
  const tsconfig = path.join(root, "tsconfig.json");
  const primary = '{"compilerOptions":{"outDir":"primary"}}';
  try {
    fs.mkdirSync(preset, { recursive: true });
    fs.writeFileSync(
      path.join(preset, "package.json"),
      JSON.stringify({
        name: "preset",
        exports: {
          "./settings": {
            require: "./primary.json",
            default: "./ordinary.json",
          },
          "./raw-settings": "./raw-primary.json",
          "./hooked-settings": {
            "ttsc-test-hook": "./raw-primary.json",
            default: "./ordinary.json",
          },
        },
      }),
    );
    fs.writeFileSync(normal, '{"compilerOptions":{"outDir":"ordinary"}}');
    fs.writeFileSync(path.join(preset, "primary.json"), primary);
    fs.writeFileSync(tsconfig, '{"extends":"preset/settings","files":[]}');
    assert.equal(
      readProjectConfig({ cwd: root, tsconfig }).compilerOptions.outDir,
      path.join(preset, "primary"),
    );
    if (process.platform !== "linux") return;

    fs.writeFileSync(twin, primary);
    fs.writeFileSync(raw, primary);
    fs.symlinkSync(raw, alias);
    fs.writeFileSync(tsconfig, '{"extends":"preset/raw-settings","files":[]}');
    assert.equal(fs.readFileSync(alias, "utf8"), primary);
    assert.throws(() => readProjectConfig({ cwd: root, tsconfig }), {
      message: `ttsc: extended config has no UTF-8 physical path: ${alias}`,
    });
    if (!RuntimeLoaderCapabilities.requireResolveConsultsHooks()) return;

    const callerError = new Error("caller resolver refused the selection");
    const hooks = registerHooks({
      resolve(specifier, context, next) {
        if (specifier === "preset/raw-settings") throw callerError;
        if (specifier === "preset/hooked-settings")
          return next(specifier, {
            ...context,
            conditions: [...context.conditions, "ttsc-test-hook"],
          });
        return next(specifier, context);
      },
    });
    try {
      fs.writeFileSync(
        tsconfig,
        '{"extends":"preset/hooked-settings","files":[]}',
      );
      assert.throws(() => readProjectConfig({ cwd: root, tsconfig }), {
        message: `ttsc: extended config has no UTF-8 physical path: ${alias}`,
      });
      assert.throws(
        () =>
          resolveNativePackagePath(
            createRequire(tsconfig),
            tsconfig,
            "preset/raw-settings",
            "extended config",
          ),
        (error) => error === callerError,
      );
    } finally {
      hooks.deregister();
    }
  } finally {
    if (process.platform === "linux" && fs.existsSync(raw)) {
      if (fs.lstatSync(alias, { throwIfNoEntry: false })?.isSymbolicLink())
        fs.unlinkSync(alias);
      fs.unlinkSync(raw);
    }
    fs.rmSync(root, { recursive: true });
  }
}

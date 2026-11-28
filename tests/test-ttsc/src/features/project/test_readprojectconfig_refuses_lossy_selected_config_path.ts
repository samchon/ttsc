import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies config ownership cannot use a lossy POSIX physical spelling.
 *
 * 1. Read a valid U+FFFD config and verify its physical ownership and options.
 * 2. Link the discovery name to a separate raw config with the same bytes.
 * 3. Require the explicit, discovered and directly inherited paths to fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the maintained config reader through explicit selection, discovery and direct extends. A native byte path must fail at physical qualification before selecting the other file.
 * @evidence contracts/testing.md#independent-expectations The fixture authors separate byte paths with identical JSON and verifies the alias is readable by native I/O. The ordinary file supplies its independently authored output directory and path.
 * @evidence contracts/testing.md#distinguishing-cases A valid replacement-character name works on every host. Linux exercises explicit file, explicit directory, discovery and direct extends of the raw target with an existing valid twin.
 * @evidence contracts/testing.md#execution-ownership The unit owns and removes all fixture paths and uses the original compiler config reader without starting a compiler or changing process environment.
 */
export function test_readprojectconfig_refuses_lossy_selected_config_path(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-raw-config-")),
  );
  const contents = '{"compilerOptions":{"outDir":"out"},"files":[]}';
  const twin = path.join(root, "config-\ufffd.json");
  const alias = path.join(root, "tsconfig.json");
  const raw = Buffer.concat([
    Buffer.from(`${root}/config-`),
    Buffer.from([0xff]),
    Buffer.from(".json"),
  ]);
  try {
    fs.writeFileSync(twin, contents);
    const ordinary = readProjectConfig({ cwd: root, tsconfig: twin });
    assert.equal(ordinary.path, twin);
    assert.equal(ordinary.compilerOptions.outDir, path.join(root, "out"));
    if (process.platform !== "linux") return;

    fs.writeFileSync(raw, contents);
    fs.symlinkSync(raw, alias);
    assert.equal(fs.readFileSync(alias, "utf8"), contents);
    assert.equal(fs.readFileSync(twin, "utf8"), contents);
    for (const tsconfig of [alias, root, undefined]) {
      assert.throws(
        () => readProjectConfig({ cwd: root, tsconfig }),
        (error) =>
          error instanceof Error &&
          error.message ===
            `ttsc: selected config has no UTF-8 physical path: ${alias}`,
      );
    }

    const inherited = path.join(root, "consumer.json");
    fs.writeFileSync(inherited, '{"extends":"./tsconfig.json","files":[]}');
    assert.throws(
      () => readProjectConfig({ cwd: root, tsconfig: inherited }),
      (error) =>
        error instanceof Error &&
        error.message ===
          `ttsc: extended config has no UTF-8 physical path: ${alias}`,
    );
  } finally {
    if (process.platform === "linux") {
      if (fs.existsSync(alias)) fs.unlinkSync(alias);
      if (fs.existsSync(raw)) fs.unlinkSync(raw);
    }
    fs.rmSync(root, { recursive: true });
  }
}

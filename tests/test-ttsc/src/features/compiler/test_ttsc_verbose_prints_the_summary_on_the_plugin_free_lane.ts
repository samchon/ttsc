import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `--verbose` prints the documented build summary on a project that
 * declares no ttsc plugin.
 *
 * The flag worked only on the native-host lane, which runs when a project has
 * at least one native plugin, so on the common case it produced nothing on
 * either stream while the guide and `--help` both promise "the build summary
 * and emitted files". Verbosity is a presentation concern; which lane
 * `runBuild` picks is an implementation detail the user cannot see, so a
 * documented flag must not change meaning with it.
 *
 * 1. Build a plugin-free project once with `--verbose` and once without.
 * 2. Assert the verbose run prints the header, the count, and one line per emitted
 *    file, with no raw `TSFILE:` line leaking through.
 * 3. Assert the plain run stays silent, so the flag is what produced the output.
 */
export const test_ttsc_verbose_prints_the_summary_on_the_plugin_free_lane =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export const value: string = "verbose";\n`,
      "src/other.ts": `export const other: number = 1;\n`,
    });

    const verbose = spawn(ttscBin, ["--cwd", root, "--emit", "--verbose"], {
      cwd: root,
    });
    assert.equal(verbose.status, 0, verbose.stderr);
    assert.match(verbose.stdout, /^\/\/ ttsc: tsconfig=.* sites=0 emit=true$/m);
    assert.match(verbose.stdout, /^\/\/ ttsc: emitted=\d+ files$/m);
    assert.match(verbose.stdout, /^ {2}\+ .*main\.js$/m);
    assert.match(verbose.stdout, /^ {2}\+ .*other\.js$/m);
    // The list is derived from the parsed set; tsgo's own listing is internal.
    assert.ok(
      !verbose.stdout.includes("TSFILE:"),
      `raw listing leaked into user output:\n${verbose.stdout}`,
    );

    const plain = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.equal(plain.status, 0, plain.stderr);
    assert.equal(
      plain.stdout.trim(),
      "",
      `a build without a verbosity flag must stay silent:\n${plain.stdout}`,
    );
  };

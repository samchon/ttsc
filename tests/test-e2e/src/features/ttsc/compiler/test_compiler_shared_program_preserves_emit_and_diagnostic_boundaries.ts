import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import { isolatedCacheEnvironment } from "../../../internal/ttsc/internal/isolated-cache-environment";
import {
  assertNoProjectAbove,
  child_process,
  nativeBinary,
  spawn,
  tsgoBinary,
  ttscBin,
  workspaceRoot,
} from "../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies shared compiler output, refusals and watch transitions on one
 * corpus.
 *
 * Compatible arithmetic, class, declaration, map and extension-import sources
 * compile together. The same project then changes its emit policy and receives
 * syntax, bind and semantic failures. Syntax errors prevent the compiler from
 * collecting semantic diagnostics, so syntax needs its own command; bind and
 * semantic errors share the same invalid Program. The selected native compiler
 * rejects removed AMD/outFile options. One negative rebuild preserves that
 * refusal, then a supported CommonJS incremental rebuild verifies
 * config-relative build info and quiet output.
 *
 * 1. Emit every valid module together with spaced target/module flags, checker
 *    selection and verbose reporting, then execute the arithmetic and import
 *    outputs.
 * 2. Reuse those inputs for a single-threaded lowercase outDir/listing command,
 *    declaration-only output, default JavaScript/declaration emission with
 *    quiet output and configured/explicit no-emit states.
 * 3. Require syntax and bind/semantic guards, terminal output, cache reports and
 *    safe cleanup through the physical root and its linked alias.
 * 4. Reuse the workspace for live watch invalidations and positional output modes,
 *    then join every child before releasing its inputs. The output host rejects
 *    removed bundle options before recovering with supported incremental
 *    emission in that same host.
 *
 * @evidence contracts/testing.md#behavioral-verification Real launcher commands require every independently named malformed-option diagnostic, retain native uppercase-boolean rejection and false/null declaration clearing, accept disabled composite in noEmit mode, print selected help through all three original entrypoints and initialize absent/existing configs without rewriting authored bytes. They emit eleven authored modules together and retain runtime 5/import message, checker/threading exports, declaration/map artifacts, class lowering, ordered CommonJS, rewrite/listing/verbose/quiet behavior and positive/negative emit policy. The ordinary default command publishes both JavaScript and configured declarations without an explicit emit override. Disabled showConfig requires TS2322 without TS5096 or JavaScript; lowercase reenable prints exactly one config without noEmitOnError. Four sparse layout requests preserve configured noEmit without rootDir/outDir, same-basename positional ownership without sibling writes, directory-valued project selection without a root config, and nested-config relative emission. Two additional sparse requests retain configured rootDir with no outDir, default positional suppression and explicit emit publication from the original number-valued source. Cache assertions cover roots, safe removals, preserved sentinels and relative cleanup through a junction. Watch assertions cover mixed-case host ownership, external config/source/reference edits, included lib/dist/new-directory inputs, unrelated README silence, config attribution/recovery, latest throwing-build IPC status, native output boundaries, removed AMD/outFile diagnostics and bundle absence, supported incremental JavaScript and default build-info placement, both positional JSX overrides and both positional analysis modes before/after original value1 and value2 edits. The noEmit host additionally compiles the original broken assignment, requires TS2322 and broken.js absence, and joins with the product's natural failed-build code2 and null signal. Existing emitting and check hosts additionally require forwarded strictness to reject authored nullable access despite nonstrict config and then recover before successful join. POSIX additionally preserves actual failed-build SIGTERM status with null signal. A source-unit-loader child additionally calls the source SDK and selected native producer for five JSX modes with tsx/jsx inputs together, verifies actual emittedSources ownership, and performs two react-native positional emission calls.
 * @evidence contracts/testing.md#independent-expectations Literal arithmetic, import message, artifact paths, class lowering, diagnostic/config wording and cache reports follow authored inputs and supported option meaning. Selected compiler help requires its literal heading without a missing-project error; initialization requires absent-config publication or exact authored baseline preservation. Reversed diagnostics values independently require Check time or no time text. Watch transitions use independently authored config/source edits and later completion markers; literal native suffixes and build-info paths distinguish actual output from guessed exclusions. Sparse layout requests retain the original check-only/requested-entry/sibling-entry/explicit-project literals and exact absence assertions; cold output guards prevent earlier publication from supplying a later result. Expected values are not copied from compiler results. Configured noEmit rootDir/include paths are rebased only to the owned staged source tree; target, module, strictness, noEmit and original number-valued source bytes remain authored. The invalid assignment literal independently requires TS2322 and the real failed-build code2 is read from the nonce-bound child close, never assigned by the test. Map presence does not claim mapping fidelity, and bounded quiet intervals do not prove permanent silence. Source-artifact markers, JSX suffixes, retained JSX, classic createElement and automatic runtime module names are independently authored. A declaration-only input has no JavaScript owner.
 * @evidence contracts/testing.md#distinguishing-cases Valid emission contrasts with syntax and joint bind/semantic failures, declaration-only and three no-emit states contrast with default ordinary JavaScript/declaration output, and spaced target/module override the baseline. Sparse layouts explicitly omit the ordinary corpus options and select only their staged original source population. Original project/positional argument structure is preserved with owned relative paths; no physically outside-cwd configuration is claimed. Terminal profiles explicitly enable extension rewriting without noEmit/declaration-only suppression, preserving the failed-emit guard. Watch contrasts absent/preexisting initial outDir, external versus unrelated changes, newly discovered versus later-edited directories, failed versus repaired configs, config versus CLI JSX modes, noEmit versus check aliases, removed bundle options versus supported incremental recovery and IPC versus POSIX SIGTERM shutdown. Each output profile begins without its expected artifact. Source-artifact contexts distinguish preserve/react/react-native/automatic/development modes, both source languages, response files and last JSX override without replacing installed CLI or watch evidence.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this E2E source entry and runs the default compiler/cache/watch population. Named synchronous checks and asynchronous observations retain case failures. The optional false argument selects compiler/cache-only local verification, while normal discovery includes watches. Source-unit flag, mode, terminal, JSX resolver and cache-dispatch entries own portable policies without native processes. Default discovery additionally invokes exactly runSourceCompilerProvenanceCorpus through one source-unit-loader child on this same tracked project. The false local argument retains its compiler/cache-only population without that source-artifact child.
 * @evidence contracts/e2e.md#necessary-boundary Actual launcher/native emission and generated Node execution establish artifacts and phase-specific refusals. Kernel junction selection, native-resolved watch inputs, output callbacks, private positional copying and real IPC/SIGTERM shutdown require running hosts; portable parsing and output-name units cannot establish those connections. The source-artifact child separately verifies selected native writes through source BuildExecution, the external-provenance adapter emittedSources relation and EmitOwnershipIndex; synthetic source units cannot certify that producer connection.
 * @evidence contracts/e2e.md#shared-execution One tracked workspace shares twenty compiler/cache commands, including two malformed-option commands, and two Node executions, then six sparse-layout commands preserve four original layouts and a configured noEmit/default-versus-explicit-emit pair without allocating projects, and five terminal commands reuse its project root for selected compiler help and absent/existing config initialization. Repeated diagnostics orderings share the first two existing emit commands without adding a command. Eleven modules share initial emission. Syntax needs its own diagnostic command because native syntax errors suppress later phases; bind and semantic errors share one Program. Six watch hosts on Windows, plus one SIGTERM host on POSIX, use this same workspace. Two project hosts preserve absent/preexisting cold outDir; the second changes config/source selection for three output layouts and adds one removed-option rejection before supported incremental recovery without creating hosts. Opposite JSX overrides and noEmit/check positional requests have immutable different argv. Their initial cycles execute the same runSingleFile emitter/copy operation as the original duplicate one-shot overrides; configured preserve retains one standalone positional command with --pretty immediately before its TSX input, requiring zero status, no TS5042 and only the actual JSX copy. Bare emitting and check hosts each add a nullable-error and repair cycle with explicit strict overriding nonstrict config; these four authored source transitions add no host or public command. Producer artifacts are reused without builds or installs here. The separate source-artifact receipt uses one child and the same project/executable for five producing JSX contexts and two source positional emit operations. Seven owning emit operations are not seven measured native processes or Programs; internal configuration/provenance probes remain uncounted. The three original noEmit-form/invalid one-shot requests transfer into existing analysis hosts with one additional failed native cycle; the configured suppression/override pair keeps two actual CLI requests. Old five requests become two CLI requests plus one added cycle after verified retirement, a net reduction of two requests. Current core requests increase from 29 to 31 while old entries remain; Windows watch hosts stay six. No additional project, installation or contributor build is introduced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Core states reset only dist/out and owned negative inputs and restore baseline config; five sparse profiles each own an absent layout-profile subtree, restore exact config bytes after actual normal child exit and remove only that subtree before the next request. Unproved closure or release blocks later producers and retains the root; native/plugin caches are not globally deleted. Watch edits wait for settled/quiet state and a later completion count. Only the config-relative build metadata is reset after removed-option rejection so the supported incremental profile must publish it cold. Positional output files are removed between modes after host closure. Every WatchSession names the encompassing workspace and requires nonce-bound IPC receipt plus actual close; an unproved join blocks later host creation and retains inputs. The plugin-free POSIX signal case waits for its synchronous native failed-build marker before SIGTERM and awaits actual close even after timeout escalation; forced or unhandled termination retains inputs. Final removal occurs only when process ownership is proved. Source-artifact fixtures stay outside the ordinary src include until that phase, then only absent owned input paths and one owned output directory are staged and independently released. Exact config bytes and every staged path are checked after actual child exit; unproved release prevents later watch hosts and retains the workspace.
 * @evidence contracts/e2e.md#preserved-coverage This corpus owns plain project, threading, declaration/map, spaced flags, rewrite, listing/verbosity, emit policy, diagnostic/terminal and cache boundary assertions, plus four sparse positional/project layout requests. Their source/output paths are rebased under one owned layout-profile subtree while original source literals, absent rootDir/outDir, root-config absence, config-relative layout and public argv choices remain; the original entries stay until actual whole verification passes. Terminal spelling/boolean and JSX output selection have direct source-unit owners, while actual print/copy/output absence remain here. The build-mode source unit owns exact --pretty/src/main.ts files and passthrough arrays; this existing configured-preserve command retains the original zero status, no TS5042 and actual single-file output oracle on a TSX input without another process. Project watch transitions retain linked presentation, mixed-case host banners, every external/included/unrelated input distinction, failure attribution/recovery and native output/quiet assertions. Positional watch initial cycles also retain both duplicate one-shot CLI override output assertions; both analysis aliases retain initial/rebuild/final output absence and emitted-path silence; the noEmit alias additionally retains the original invalid assignment diagnostic, nonzero result and broken.js absence through actual failed IPC close code2. The configured rootDir/no-outDir pair preserves both default suppression and explicit-emit positive on cold adjacent output. The POSIX host retains strict failed-build SIGTERM code/signal assertions. Existing entries remain until this consolidated population has been verified, so the draft does not certify removal or successful native execution. The authored source-artifact matrix adds five-mode two-language native ownership and two react-native consumer connections; it remains unverified until its complete runtime gate. Its source SDK proof does not certify old installed libraries, native ambiguity, outside-fileset diagnostics or POSIX transport.
 */
export async function test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries(
  runWatch = true,
): Promise<void> {
  const workspace = TestProject.createProject(
    Object.fromEntries([
      ...Object.entries(FixtureFiles.read("ttsc/compiler/corpus")).map(
        ([name, contents]) => [`project/${name}`, contents],
      ),
      ...Object.entries(FixtureFiles.read("ttsc/compiler/watch")),
      ...Object.entries(FixtureFiles.read("ttsc/compiler/subprojects")).map(
        ([name, contents]) => [`subprojects/${name}`, contents],
      ),
    ]),
  );
  const root = path.join(workspace, "project");
  const link = path.join(workspace, "linked-project");
  const baseline = fs.readFileSync(path.join(root, "tsconfig.json"), "utf8");
  const failures: Error[] = [];
  let ownershipProved = true;
  const inputEntryAbsent = (filename: string): boolean => {
    try {
      fs.lstatSync(filename);
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      ownershipProved = false;
      throw error;
    }
  };
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const output = (name: string, directory = "dist") =>
    path.join(root, directory, name);
  const read = (name: string) => fs.readFileSync(output(name), "utf8");
  const reset = (changes: Record<string, unknown> = {}): void => {
    for (const directory of ["dist", "out"])
      fs.rmSync(path.join(root, directory), { recursive: true, force: true });
    fs.rmSync(path.join(root, "src", "negative"), {
      recursive: true,
      force: true,
    });
    const config = JSON.parse(baseline);
    Object.assign(config.compilerOptions, changes);
    fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify(config));
  };
  const command = (argv: string[]) =>
    spawn(
      ttscBin,
      ["--cwd", root, "--target", "es2020", "--module", "commonjs", ...argv],
      { cwd: root },
    );
  try {
    fs.symlinkSync(root, link, "junction");
    const configPath = path.join(root, "tsconfig.json");
    fs.rmSync(configPath);
    try {
      assertNoProjectAbove(root);
      for (const argv of [["--all"], ["-?"], ["build", "--all"]]) {
        const help = spawn(ttscBin, ["--cwd", root, ...argv], { cwd: root });
        check(
          `selected compiler help without a project / ${argv.join(" ")}`,
          () => {
            const text = `${help.stdout}${help.stderr}`;
            assert.equal(help.status, 0, text);
            assert.match(text, /TypeScript Compiler/);
            assert.doesNotMatch(text, /could not find tsconfig\.json/);
          },
        );
      }
      for (const argv of [["--showConfig"], ["--listFilesOnly"], []]) {
        const required = spawn(ttscBin, ["--cwd", root, ...argv], {
          cwd: root,
        });
        check(
          `project-describing terminal flag still requires a project / ${argv.join(" ") || "no flag"}`,
          () => {
            const text = `${required.stdout}${required.stderr}`;
            assert.equal(required.status, 2, text);
            assert.match(
              text,
              /ttsc: could not find tsconfig\.json or jsconfig\.json starting from /,
            );
          },
        );
      }
      const publicHelp = spawn(ttscBin, ["--help"], { cwd: workspaceRoot });
      check("public command help lists every command and the plugin contract", () => {
        assert.equal(publicHelp.status, 0, publicHelp.stderr);
        assert.match(
          publicHelp.stdout,
          /standalone compiler adapter and plugin host/,
        );
        assert.match(publicHelp.stdout, /ttsc prepare \[options\]/);
        assert.match(publicHelp.stdout, /ttsc clean \[options\]/);
        assert.match(publicHelp.stdout, /ttsc fix \[options\]/);
        assert.match(publicHelp.stdout, /ttsc format \[options\]/);
        assert.match(publicHelp.stdout, /ttsc cache paths --json/);
        assert.match(publicHelp.stdout, /Plugin contract:/);
      });
      const versionBanner = spawn(ttscBin, ["--version"], {
        cwd: workspaceRoot,
      });
      check("version banner names ttsc and the native compiler", () => {
        assert.equal(versionBanner.status, 0, versionBanner.stderr);
        assert.match(versionBanner.stdout, /^ttsc /);
        assert.match(versionBanner.stdout, /\(Version 7\./);
      });
      const initialized = spawn(ttscBin, ["--cwd", root, "--init"], {
        cwd: root,
      });
      check("native init publishes an absent project config", () => {
        assert.equal(
          initialized.status,
          0,
          `${initialized.stdout}${initialized.stderr}`,
        );
        assert.equal(fs.existsSync(configPath), true);
      });
      // Restore independently authored bytes rather than treating generated
      // initialization output as the preservation oracle for the next request.
      fs.writeFileSync(configPath, baseline);
      const existing = spawn(ttscBin, ["--cwd", root, "--init"], {
        cwd: root,
      });
      check("native init preserves an authored existing project config", () => {
        assert.equal(
          existing.status,
          0,
          `${existing.stdout}${existing.stderr}`,
        );
        assert.equal(fs.readFileSync(configPath, "utf8"), baseline);
      });
    } finally {
      fs.writeFileSync(configPath, baseline);
    }
    reset();
    const transform = spawn(ttscBin, ["transform", "--cwd", root], {
      cwd: root,
    });
    check("unsupported transform command is rejected as unknown", () => {
      assert.notEqual(transform.status, 0);
      assert.match(transform.stderr, /unknown command "transform"/);
    });
    const fixWatch = spawn(ttscBin, ["fix", "--watch", "--cwd", root], {
      cwd: root,
    });
    check("fix refuses watch mode", () => {
      assert.notEqual(fixWatch.status, 0);
      assert.match(fixWatch.stderr, /fix does not support watch mode/);
    });
    const built = command([
      "--emit",
      "--checkers",
      "2",
      "--verbose",
      "--diagnostics",
      "false",
      "--diagnostics",
      "true",
    ]);
    check("last enabled diagnostics prints native timing", () => {
      assert.equal(built.status, 0, built.stderr);
      assert.match(built.stdout + built.stderr, /Check time/i);
    });
    check("plain project exports", () => {
      assert.equal(built.status, 0, built.stderr);
      assert.match(read("main.js"), /exports\.add/);
    });
    check("checker selection exports", () => {
      assert.equal(built.status, 0, built.stderr);
      assert.match(read("checkers.js"), /exports\.value/);
    });
    for (const name of ["spaced.js", "ordered.js"])
      check(`spaced target and ordered module values / ${name}`, () => {
        const emitted = read(name);
        assert.match(emitted, /constructor\s*\(/);
        assert.match(emitted, /this\.field\s*=\s*(?:exports\.)?value/);
        assert.match(emitted, /exports\.Box\s*=/);
        assert.doesNotMatch(emitted, /export\s+(?:const|class)\s/);
      });
    check("declaration forwarding", () => {
      assert.equal(fs.existsSync(output("box.js")), true);
      assert.equal(fs.existsSync(output("box.d.ts")), true);
    });
    check("sourceMap forwarding", () => {
      assert.equal(fs.existsSync(output("mapped.js.map")), true);
    });
    check("plain project arithmetic runtime", () => {
      const result = spawn(process.execPath, [output("main.js")], {
        cwd: root,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "5");
    });
    check("allowImportingTsExtensions rewrite and runtime", () => {
      assert.match(read("extensions.js"), /helper\.js/);
      const result = spawn(process.execPath, [output("extensions.js")], {
        cwd: root,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "ttsc-emit-extension-ok");
    });
    check("verbose emits both source identities without raw listing", () => {
      assert.match(built.stdout, /^\/\/ ttsc: tsconfig=.* sites=0 emit=true$/m);
      assert.match(built.stdout, /^\/\/ ttsc: emitted=\d+ files$/m);
      assert.match(built.stdout, /^ {2}\+ .*main\.js$/m);
      assert.match(built.stdout, /^ {2}\+ .*other\.js$/m);
      assert.equal(built.stdout.includes("TSFILE:"), false);
    });

    reset();
    const threaded = command([
      "--emit",
      "--singleThreaded",
      "--outdir",
      "out",
      "--listemittedfiles",
      "--declaration",
      "false",
      "--diagnostics",
      "true",
      "--diagnostics",
      "false",
    ]);
    check("single-threaded / lowercase outDir and listing", () => {
      assert.equal(threaded.status, 0, threaded.stderr);
      assert.match(
        fs.readFileSync(output("single.js", "out"), "utf8"),
        /exports\.value/,
      );
      assert.equal(fs.existsSync(output("main.js", "out")), true);
      assert.equal(fs.existsSync(output("main.js")), false);
      assert.match(threaded.stdout, /TSFILE:.*main\.js/);
      assert.doesNotMatch(threaded.stdout + threaded.stderr, /time/i);
      assert.equal(fs.existsSync(output("main.d.ts", "out")), false);
    });

    reset({ emitDeclarationOnly: true });
    const declarations = command(["--listEmittedFiles"]);
    check("declaration-only output", () => {
      assert.equal(declarations.status, 0, declarations.stderr);
      assert.equal(fs.existsSync(output("pair.d.ts")), true);
      assert.equal(fs.existsSync(output("pair.js")), false);
      assert.match(declarations.stdout, /TSFILE:.*pair\.d\.ts/);
    });

    // Default project emission must publish both ordinary JavaScript and the
    // configured declarations without an explicit launcher emit override.
    // Keep the shared extension import valid in that raw default lane.
    reset({ rewriteRelativeImportExtensions: true });
    const plain = command([]);
    check("default declaration emission and quiet compiler output", () => {
      assert.equal(plain.status, 0, plain.stderr);
      assert.equal(fs.existsSync(output("box.js")), true);
      assert.equal(fs.existsSync(output("box.d.ts")), true);
      assert.equal(plain.stdout.trim(), "");
    });

    for (const [name, config, argv] of [
      ["valid noEmit", {}, ["--composite", "false", "--noEmit"]],
      ["explicit disabled emit", {}, ["--emit=false"]],
      ["configured noEmit", { noEmit: true }, []],
    ] as const) {
      reset(config);
      const result = command([...argv]);
      check(name, () => {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.existsSync(output("main.js")), false);
      });
    }
    reset({ noEmit: true });
    const overridden = command(["--noEmit=false", "--declaration", "null"]);
    check("explicit noEmit false overrides configuration", () => {
      assert.equal(overridden.status, 0, overridden.stderr);
      assert.equal(fs.existsSync(output("main.js")), true);
      assert.equal(fs.existsSync(output("main.d.ts")), false);
    });

    reset({ rewriteRelativeImportExtensions: true });
    const malformedFlags = command([
      "--outFile=dist/bundle.js",
      "--jsx=preserve",
      "--buildish",
      "--composite",
    ]);
    for (const [label, expected] of [
      [
        "inline outFile",
        /Unknown compiler option '--outFile=dist\/bundle\.js'/i,
      ],
      ["inline JSX", /Unknown compiler option '--jsx=preserve'/i],
      ["build prefix unknown", /buildish/i],
      [
        "enabled config-only composite",
        /composite.*only be specified in ['"]tsconfig\.json/i,
      ],
    ] as const)
      check(`native malformed option collection / ${label}`, () => {
        assert.notEqual(malformedFlags.status, 0);
        assert.match(malformedFlags.stdout + malformedFlags.stderr, expected);
        assert.doesNotMatch(
          malformedFlags.stdout + malformedFlags.stderr,
          /solution mode/,
        );
        assert.equal(fs.existsSync(output("main.js")), false);
      });
    const uppercaseBoolean = command(["--declaration", "FALSE", "--noEmit"]);
    check("uppercase boolean remains a native positional error", () => {
      assert.notEqual(uppercaseBoolean.status, 0);
      assert.match(
        uppercaseBoolean.stdout + uppercaseBoolean.stderr,
        /project.*cannot be mixed with source files|TS5042/i,
      );
      assert.equal(fs.existsSync(output("main.js")), false);
    });

    // Solution-mode refusal must not over-match neighbouring spellings: the
    // `build` subcommand and forwarded incremental build-info flags build the
    // project, while `--buildish` above stays an unknown option.
    const buildSubcommand = spawn(ttscBin, ["build", "--cwd", root], {
      cwd: root,
    });
    check("build subcommand builds instead of refusing solution mode", () => {
      assert.equal(
        buildSubcommand.status,
        0,
        `${buildSubcommand.stdout}${buildSubcommand.stderr}`,
      );
      assert.equal(fs.existsSync(output("main.js")), true);
      assert.doesNotMatch(buildSubcommand.stderr, /solution mode/);
    });
    fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
    const forwardedBuildInfo = spawn(
      ttscBin,
      [
        "--cwd",
        root,
        "--incremental",
        "--tsBuildInfoFile",
        "dist/app.tsbuildinfo",
      ],
      { cwd: root },
    );
    check("forwarded incremental flags are not refused as solution mode", () => {
      assert.equal(
        forwardedBuildInfo.status,
        0,
        `${forwardedBuildInfo.stdout}${forwardedBuildInfo.stderr}`,
      );
      assert.doesNotMatch(forwardedBuildInfo.stderr, /solution mode/);
    });

    const negatives = FixtureFiles.read("ttsc/compiler/negative");
    for (const phases of [["syntax"], ["semantic", "bind"]] as const) {
      reset();
      fs.mkdirSync(path.join(root, "src", "negative"));
      for (const phase of phases) {
        const contents = negatives[`${phase}.ts`];
        if (contents === undefined)
          throw new Error("Missing authored compiler negative input: " + phase);
        fs.writeFileSync(
          path.join(root, "src", "negative", `${phase}.ts`),
          contents,
        );
      }
      const result = command(["--emit"]);
      for (const phase of phases)
        check(`${phase} diagnostics stop whole Program emit`, () => {
          assert.notEqual(result.status, 0);
          assert.match(
            result.stderr,
            {
              semantic: /Type 'number' is not assignable to type 'string'/,
              syntax: /Expression expected|Declaration or statement expected/,
              bind: /Cannot redeclare block-scoped variable 'value'/,
            }[phase],
          );
          assert.equal(fs.existsSync(output("main.js")), false);
          assert.equal(fs.existsSync(output(`negative/${phase}.js`)), false);
        });
      if (phases[0] === "semantic") {
        // Raw terminal passthrough does not use the explicit --emit adapter.
        // Keep extension imports valid here without suppressing ordinary emit,
        // so output absence still distinguishes the diagnostic guard.
        const terminalConfig = JSON.parse(baseline);
        terminalConfig.compilerOptions.rewriteRelativeImportExtensions = true;
        fs.writeFileSync(
          path.join(root, "tsconfig.json"),
          JSON.stringify(terminalConfig),
        );
        const disabled = command(["--showConfig", "false"]);
        check("disabled terminal flag retains diagnostic guard", () => {
          assert.notEqual(disabled.status, 0, disabled.stdout);
          assert.match(disabled.stdout + disabled.stderr, /TS2322/);
          assert.doesNotMatch(disabled.stdout + disabled.stderr, /TS5096/);
          assert.equal(fs.existsSync(output("main.js")), false);
        });
        const enabled = command([
          "--showConfig",
          "false",
          "--showconfig",
          "true",
        ]);
        check(
          "reenabled terminal flag bypasses compilation without emit",
          () => {
            assert.equal(enabled.status, 0, enabled.stderr);
            assert.equal(
              enabled.stdout.split('"compilerOptions"').length - 1,
              1,
            );
            assert.doesNotMatch(enabled.stdout, /noEmitOnError/);
            assert.equal(fs.existsSync(output("main.js")), false);
          },
        );
      }
    }

    // Positional single-file requests compile the whole project into a private
    // directory and copy exactly one output, so the configured outDir, an
    // explicit command-line outDir and the extension rewrite must each reach
    // that copy.
    reset();
    const singleConfigured = command(["src/main.ts"]);
    check("single-file mode honors the configured outDir", () => {
      assert.equal(singleConfigured.status, 0, singleConfigured.stderr);
      assert.equal(
        fs.existsSync(output("main.js")),
        true,
        `expected emit at ${output("main.js")}, stdout=${singleConfigured.stdout}`,
      );
      assert.equal(
        fs.existsSync(path.join(root, "src", "main.js")),
        false,
        "no JavaScript may be dropped next to src/main.ts",
      );
      const run = spawn(process.execPath, [output("main.js")], { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "5");
    });
    reset();
    const singleExplicit = command(["--outDir", "single", "src/main.ts"]);
    check("single-file mode writes under an explicit outDir", () => {
      assert.equal(singleExplicit.status, 0, singleExplicit.stderr);
      const emitted = path.join(root, "single", "src", "main.js");
      assert.equal(fs.existsSync(emitted), true);
      const run = spawn(process.execPath, [emitted], { cwd: root });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), "5");
    });
    fs.rmSync(path.join(root, "single"), { recursive: true, force: true });
    reset();
    const singleRewrite = command(["src/extensions.ts"]);
    check("single-file emit rewrites allowImportingTsExtensions imports", () => {
      assert.equal(singleRewrite.status, 0, singleRewrite.stderr);
      assert.match(read("extensions.js"), /helper\.js/);
    });

    // Sparse original layouts must not inherit the ordinary corpus's rootDir,
    // extension-import or declaration options. Only these staged sources belong
    // to each layout Program; the existing tracked compiler root remains owner.
    const layoutRoot = path.join(root, "layout-profile");
    const stageLayout = (source: string, destination: string): void => {
      const target = path.join(layoutRoot, destination);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(
        target,
        fs.readFileSync(path.join(root, "layout-inputs", source)),
        { flag: "wx" },
      );
    };
    for (const profile of [
      "noEmit",
      "emit",
      "directory",
      "nested",
      "configuredNoEmit",
    ] as const) {
      if (!ownershipProved) break;
      let ownsLayout = false;
      check(`sparse original layout / ${profile}`, () => {
        if (!inputEntryAbsent(layoutRoot)) ownershipProved = false;
        assert.equal(
          inputEntryAbsent(layoutRoot),
          true,
          "layout must start absent",
        );
        try {
          fs.mkdirSync(layoutRoot);
        } catch (error) {
          ownershipProved = false;
          throw error;
        }
        ownsLayout = true;
        let argv: string[];
        if (profile === "configuredNoEmit") {
          stageLayout("configured-noemit.ts", "src/main.ts");
          fs.writeFileSync(
            path.join(root, "tsconfig.json"),
            fs.readFileSync(
              path.join(root, "layout-inputs/configured-noemit.json"),
            ),
          );
          argv = ["layout-profile/src/main.ts"];
        } else if (profile === "noEmit" || profile === "emit") {
          stageLayout(
            profile === "noEmit" ? "check-only.ts" : "requested.ts",
            "src/main.ts",
          );
          if (profile === "emit")
            stageLayout("sibling.ts", "src/other/main.ts");
          fs.writeFileSync(
            path.join(root, "tsconfig.json"),
            JSON.stringify({
              compilerOptions: {
                target: "ES2022",
                module: "commonjs",
                strict: true,
                ...(profile === "noEmit" ? { noEmit: true } : {}),
              },
              include: ["layout-profile/src"],
            }),
          );
          argv = ["layout-profile/src/main.ts"];
        } else if (profile === "directory") {
          stageLayout("directory.ts", "sub/main.ts");
          stageLayout("directory.json", "sub/tsconfig.json");
          fs.rmSync(path.join(root, "tsconfig.json"));
          assert.equal(fs.existsSync(path.join(root, "tsconfig.json")), false);
          argv = ["-p", "layout-profile/sub", "--noEmit"];
        } else {
          stageLayout("explicit.ts", "src/main.ts");
          stageLayout("nested.json", "configs/tsconfig.app.json");
          argv = [
            "--project",
            "layout-profile/configs/tsconfig.app.json",
            "--emit",
          ];
        }
        for (const target of [
          "src/main.js",
          "src/other/main.js",
          "dist/app/main.js",
        ])
          assert.equal(
            fs.existsSync(path.join(layoutRoot, target)),
            false,
            `cold output: ${target}`,
          );
        // The ordinary command helper prepends ES2020. Original sparse profiles
        // instead reach the launcher with their own ES2022 config and argv.
        const result = spawn(ttscBin, ["--cwd", root, ...argv], { cwd: root });
        if (result.status === null || result.signal !== null) {
          ownershipProved = false;
          throw new Error("Sparse layout child did not prove normal closure");
        }
        if (profile === "configuredNoEmit") {
          const adjacent = path.join(layoutRoot, "src/main.js");
          check("configured noEmit sparse positional status", () =>
            assert.equal(result.status, 0, result.stdout + result.stderr),
          );
          check("configured noEmit without outDir suppresses sibling", () =>
            assert.equal(fs.existsSync(adjacent), false),
          );
          check("configured noEmit prints no sibling path", () =>
            assert.equal(result.stdout.includes("main.js"), false),
          );
          // Reset only this owned output so a failed suppression oracle cannot
          // make the independent explicit-emit positive inherit JavaScript.
          fs.rmSync(adjacent, { force: true });
          assert.equal(fs.existsSync(adjacent), false);
          const override = spawn(ttscBin, ["--cwd", root, "--emit", ...argv], {
            cwd: root,
          });
          if (override.status === null || override.signal !== null) {
            ownershipProved = false;
            throw new Error(
              "Sparse noEmit override child did not prove normal closure",
            );
          }
          check("explicit emit overrides sparse configured noEmit status", () =>
            assert.equal(override.status, 0, override.stdout + override.stderr),
          );
          check("explicit emit creates the requested sparse sibling", () =>
            assert.equal(fs.existsSync(adjacent), true),
          );
        } else {
          assert.equal(result.status, 0, result.stdout + result.stderr);
          if (profile === "noEmit")
            assert.equal(
              fs.existsSync(path.join(layoutRoot, "src/main.js")),
              false,
            );
          else if (profile === "emit") {
            const text = fs.readFileSync(
              path.join(layoutRoot, "src/main.js"),
              "utf8",
            );
            assert.match(text, /requested-entry/);
            assert.doesNotMatch(text, /sibling-entry/);
            assert.equal(
              fs.existsSync(path.join(layoutRoot, "src/other/main.js")),
              false,
            );
          } else if (profile === "directory")
            assert.doesNotMatch(
              result.stdout + result.stderr,
              /unknown (command|option)/i,
            );
          else
            assert.match(
              fs.readFileSync(
                path.join(layoutRoot, "dist/app/main.js"),
                "utf8",
              ),
              /explicit-project/,
            );
        }
      });
      if (ownershipProved) {
        check(`restore sparse layout config / ${profile}`, () => {
          try {
            fs.writeFileSync(path.join(root, "tsconfig.json"), baseline);
            assert.equal(
              fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
              baseline,
            );
          } catch (error) {
            ownershipProved = false;
            throw error;
          }
        });
        if (ownsLayout)
          check(`release sparse layout inputs / ${profile}`, () => {
            try {
              fs.rmSync(layoutRoot, { recursive: true, force: true });
              assert.equal(inputEntryAbsent(layoutRoot), true);
            } catch (error) {
              ownershipProved = false;
              throw error;
            }
          });
      }
    }
    if (!ownershipProved)
      throw new AggregateError(
        failures,
        "Sparse layout ownership was not released",
      );

    // Independent project identities live beside the corpus in this workspace.
    // Each owns the one authored configuration its request needs; none shares an
    // output tree with the corpus or with another subproject.
    const subproject = (name: string): string =>
      path.join(workspace, "subprojects", name);
    const strictForwarding = subproject("strict-forwarding");
    for (const [name, argv] of [
      ["single-file lane", ["--cwd", strictForwarding, "--strict", "src/main.ts"]],
      [
        "check subcommand",
        ["check", "--cwd", strictForwarding, "--strict", "src/main.ts"],
      ],
    ] as const) {
      const forwarded = spawn(ttscBin, [...argv], { cwd: strictForwarding });
      check(`unknown flag reaches native strict checking / ${name}`, () => {
        assert.notEqual(forwarded.status, 0);
        assert.match(
          `${forwarded.stdout}${forwarded.stderr}`,
          /is possibly .?null/i,
        );
      });
    }
    const pathsPolicy = subproject("paths-policy");
    const pathsCheck = spawn(ttscBin, ["check", "--cwd", pathsPolicy], {
      cwd: pathsPolicy,
    });
    check("check resolves paths mappings under the native compiler policy", () => {
      assert.equal(pathsCheck.status, 0, pathsCheck.stderr);
    });
    const solution = subproject("solution");
    for (const argv of [
      ["--build", ".", "--cwd", solution],
      ["--cwd", solution, "--build"],
      ["-b", "--cwd", solution],
      ["check", "--build", "--cwd", solution],
    ]) {
      const refused = spawn(ttscBin, argv, { cwd: solution });
      check(`solution build is refused by ttsc itself / ${argv.join(" ")}`, () => {
        const text = `${refused.stdout}${refused.stderr}`;
        assert.equal(refused.status, 2, text);
        assert.match(
          refused.stderr,
          /ttsc: --build \(solution mode\) is not supported/,
        );
        assert.match(refused.stderr, /ttsc -p <tsconfig>/);
        assert.doesNotMatch(
          text,
          /TS6369|must be the first command line argument/,
          "the request must not reach the native compiler",
        );
      });
    }
    check("refused solution builds create no package output", () => {
      for (const pkg of ["pkg-a", "pkg-b"])
        assert.equal(fs.existsSync(path.join(solution, pkg, "dist")), false);
    });
    const singleFile = subproject("single-file");
    const outside = spawn(ttscBin, ["--cwd", singleFile, "scripts/index.ts"], {
      cwd: singleFile,
    });
    check("single-file mode refuses a file outside the project file set", () => {
      assert.notEqual(outside.status, 0, outside.stdout);
      assert.match(
        outside.stderr,
        /ttsc single-file emit: .*tsconfig\.json emitted no JavaScript owned by .*scripts[\\/]index\.ts;/,
      );
      assert.equal(fs.existsSync(path.join(singleFile, "lib")), false);
    });
    const inside = spawn(ttscBin, ["--cwd", singleFile, "src/index.ts"], {
      cwd: singleFile,
    });
    check("single-file mode emits the included same-stem file's own code", () => {
      assert.equal(inside.status, 0, `${inside.stdout}${inside.stderr}`);
      const emitted = fs.readFileSync(
        path.join(singleFile, "lib", "src", "index.js"),
        "utf8",
      );
      assert.match(emitted, /ran src\/index\.ts/);
      assert.doesNotMatch(emitted, /ran scripts/);
    });
    fs.rmSync(path.join(singleFile, "lib"), { recursive: true, force: true });
    const singleLink = path.join(workspace, "linked-single-file");
    let linkedSingle: ReturnType<typeof spawn> | undefined;
    check("single-file project is reachable through a linked cwd", () => {
      fs.symlinkSync(singleFile, singleLink, "junction");
      linkedSingle = spawn(ttscBin, ["--cwd", singleLink, "src/index.ts"], {
        cwd: singleLink,
      });
    });
    check("single-file output mirrors its source through a linked cwd", () => {
      assert.ok(linkedSingle, "the linked request did not run");
      assert.equal(
        linkedSingle.status,
        0,
        `${linkedSingle.stdout}${linkedSingle.stderr}`,
      );
      assert.equal(
        fs.existsSync(path.join(singleFile, "lib", "src", "index.js")),
        true,
        linkedSingle.stdout,
      );
      assert.equal(fs.existsSync(path.join(singleFile, "lib", "index.js")), false);
      assert.equal(
        linkedSingle.stdout.trim(),
        path.join("lib", "src", "index.js"),
      );
    });
    const sandbox = subproject("sandbox");
    const cliBundle = path.join(sandbox, "cli-bundle.js");
    const sandboxed = spawn(
      ttscBin,
      ["--cwd", sandbox, "--outFile", cliBundle, "src/input.ts"],
      { cwd: sandbox },
    );
    check("single-file mode keeps every compiler side product in its sandbox", () => {
      assert.equal(sandboxed.status, 0, `${sandboxed.stdout}${sandboxed.stderr}`);
      assert.equal(fs.existsSync(path.join(sandbox, "src", "input.js")), true);
      for (const escaped of [
        cliBundle,
        path.join(sandbox, "configured-bundle.js"),
        path.join(sandbox, "types", "input.d.ts"),
        path.join(sandbox, "state", "configured.tsbuildinfo"),
      ])
        assert.equal(
          fs.existsSync(escaped),
          false,
          `private compiler leaked ${escaped}\n${sandboxed.stdout}${sandboxed.stderr}`,
        );
    });
    const outDirOracleRoot = subproject("outdir-oracle");
    const outDirOracle = spawn(
      tsgoBinary,
      ["-p", outDirOracleRoot, "--outDir", "oracle-dist"],
      { cwd: outDirOracleRoot },
    );
    const outDirBuilt = spawn(
      ttscBin,
      ["--cwd", outDirOracleRoot, "--outDir", "ttsc-dist"],
      { cwd: outDirOracleRoot },
    );
    check("outDir flag keeps the native answer for a project without rootDir", () => {
      const oracleText = `${outDirOracle.stdout}${outDirOracle.stderr}`;
      const builtText = `${outDirBuilt.stdout}${outDirBuilt.stderr}`;
      assert.equal(
        outDirBuilt.status === 0,
        outDirOracle.status === 0,
        `ttsc and tsgo disagree on --outDir\ntsgo: ${oracleText}\nttsc: ${builtText}`,
      );
      assert.equal(
        /rootDir/.test(builtText),
        /rootDir/.test(oracleText),
        `ttsc and tsgo disagree on the layout diagnostic\ntsgo: ${oracleText}\nttsc: ${builtText}`,
      );
    });

    // Cache commands share the same project. Their sentinels are input state,
    // not another compiler project or installation.
    const cacheRoot = path.join(root, "node_modules", ".cache", "ttsc");
    const legacyModuleCache = path.join(root, "node_modules", ".ttsc");
    const legacyProjectCache = path.join(root, ".ttsc");
    const seed = (directory: string): void => {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "keep.txt"), "owned cache input\n");
    };
    const isolated = isolatedCacheEnvironment(root);
    const sentinels = [
      path.join(root, "src", "main.ts"),
      ...[
        legacyModuleCache,
        legacyProjectCache,
        path.join(cacheRoot, "plugins"),
      ].map((directory) => path.join(directory, "keep.txt")),
    ];
    for (const directory of [
      legacyModuleCache,
      legacyProjectCache,
      path.join(cacheRoot, "plugins"),
    ])
      seed(directory);
    for (const [name, argv, env] of [
      ["explicit cache equals project", ["--cache-dir", "."], isolated],
      ["Go cache equals project", [], { ...isolated, TTSC_GO_CACHE_DIR: root }],
    ] as const) {
      const result = spawn(ttscBin, ["clean", "--cwd", root, ...argv], {
        cwd: root,
        env,
      });
      check(name, () => {
        assert.equal(result.status, 2, result.stderr);
        assert.match(
          result.stderr,
          /refusing to clean cache directory.*equals or contains project root/,
        );
        for (const sentinel of sentinels)
          assert.equal(fs.existsSync(sentinel), true, sentinel);
      });
    }

    const goCache = path.join(root, ".ttsc-go-build");
    const userGoCache = path.join(root, ".user-go-cache");
    const parts = [
      "plugins",
      "go-build",
      "descriptors",
      "capabilities",
      "ttsx-orphan",
    ];
    for (const directory of [
      ...parts.map((name) => path.join(cacheRoot, name)),
      goCache,
      userGoCache,
    ])
      seed(directory);
    const orphanRoot = path.join(isolated.TEMP!, "ttsc-orphan");
    seed(path.join(orphanRoot, "ttsx-orphan"));
    const cleaned = spawn(ttscBin, ["clean", "--cwd", link], {
      cwd: link,
      env: { ...isolated, TTSC_GO_CACHE_DIR: goCache, GOCACHE: userGoCache },
    });
    check("default plugin, answer, legacy and owned Go caches", () => {
      assert.equal(cleaned.status, 0, cleaned.stderr);
      for (const name of [
        "plugins",
        "descriptors",
        "capabilities",
        "ttsx-orphan",
      ]) {
        assert.equal(fs.existsSync(path.join(cacheRoot, name)), false, name);
        assert.match(
          cleaned.stdout,
          new RegExp(
            String.raw`removed node_modules[/\\]\.cache[/\\]ttsc[/\\]` + name,
          ),
        );
      }
      for (const directory of [
        path.join(cacheRoot, "go-build"),
        goCache,
        legacyModuleCache,
        legacyProjectCache,
        orphanRoot,
      ])
        assert.equal(fs.existsSync(directory), false, directory);
      assert.equal(fs.existsSync(userGoCache), true);
      assert.equal(
        fs.existsSync(cacheRoot),
        true,
        "shared cache parent must survive",
      );
      assert.ok(
        cleaned.stdout
          .split(/\r?\n/)
          .includes(`ttsc: removed ${path.join("node_modules", ".ttsc")}`),
        cleaned.stdout,
      );
    });

    const override = path.join(root, "override-cache");
    for (const directory of [
      legacyModuleCache,
      legacyProjectCache,
      path.join(override, "plugins"),
    ])
      seed(directory);
    const overriddenCache = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: { ...isolated, TTSC_CACHE_DIR: override },
    });
    check("environment cache and legacy local cleanup", () => {
      assert.equal(overriddenCache.status, 0, overriddenCache.stderr);
      assert.match(overriddenCache.stdout, /removed node_modules[/\\]\.ttsc/);
      assert.match(overriddenCache.stdout, /removed \.ttsc/);
      for (const directory of [
        legacyModuleCache,
        legacyProjectCache,
        path.join(override, "plugins"),
      ])
        assert.equal(fs.existsSync(directory), false, directory);
    });

    const custom = path.join(root, ".custom-ttsc-cache");
    seed(path.join(custom, "plugins", "a"));
    const explicit = spawn(
      ttscBin,
      [
        "clean",
        "--cwd",
        root,
        "--cache-dir",
        custom,
        "--strict",
        "--tsconfig",
        "tsconfig.json",
      ],
      { cwd: root, env: isolated },
    );
    check("explicit cache cleanup accepts forwarded compiler flags", () => {
      assert.equal(explicit.status, 0, explicit.stderr);
      assert.match(explicit.stdout, /removed \.custom-ttsc-cache/);
      assert.equal(fs.existsSync(custom), false);
      assert.doesNotMatch(
        explicit.stdout + explicit.stderr,
        /unknown (option|command)/i,
      );
    });

    const paths = spawn(
      ttscBin,
      ["cache", "paths", "--json", "--cwd", root, "--cache-dir", ".ci/ttsc"],
      {
        cwd: TestProject.WORKSPACE_ROOT,
        env: { ...isolated, TTSC_GO_CACHE_DIR: goCache },
      },
    );
    check("public cache paths JSON delivery", () => {
      assert.equal(paths.status, 0, paths.stderr);
      const physicalRoot = fs.realpathSync(root);
      const selectedCache = path.join(physicalRoot, ".ci", "ttsc");
      const selectedGo = path.join(physicalRoot, ".ttsc-go-build");
      assert.deepEqual(JSON.parse(paths.stdout), {
        cacheRoot: selectedCache,
        acceleratorRoots: [selectedGo],
        cacheableRoots: [selectedCache, selectedGo],
        cwd: physicalRoot,
        goBuildCacheRoot: selectedGo,
        goBuildCacheSource: "TTSC_GO_CACHE_DIR",
        pluginCacheRoot: path.join(selectedCache, "plugins"),
        projectRoot: physicalRoot,
        requiredRoots: [path.join(selectedCache, "plugins")],
      });
    });

    // The cache-paths schema owns its flag spellings: case variants and the
    // project alias resolve like the canonical spelling, while a value on the
    // boolean `--json`, a stray operand and unsupported flags are refused.
    const cachePaths = (argv: string[]) =>
      spawn(ttscBin, ["cache", "paths", ...argv], { cwd: root, env: isolated });
    const canonicalPaths = cachePaths([
      "--json",
      "--cwd",
      root,
      "--cache-dir",
      ".cache",
    ]);
    const variantPaths = cachePaths([
      "--JSON",
      "--Cwd",
      root,
      "--CACHE-DIR",
      ".cache",
    ]);
    check("cache paths accepts case-variant schema flags", () => {
      assert.equal(canonicalPaths.status, 0, canonicalPaths.stderr);
      assert.equal(variantPaths.status, 0, variantPaths.stderr);
      assert.deepEqual(
        JSON.parse(variantPaths.stdout),
        JSON.parse(canonicalPaths.stdout),
      );
    });
    const aliasedPaths = cachePaths([
      "--JSON",
      "--CWD",
      root,
      "-P",
      "tsconfig.json",
    ]);
    check("cache paths accepts the project alias", () => {
      assert.equal(aliasedPaths.status, 0, aliasedPaths.stderr);
      assert.equal(
        JSON.parse(aliasedPaths.stdout).projectRoot,
        fs.realpathSync(root),
      );
    });
    for (const [name, argv, expected] of [
      [
        "a value on the boolean json flag",
        ["--json=true"],
        /--json does not take a value/,
      ],
      [
        "a spaced operand after the json flag",
        ["--json", "false"],
        /cache paths does not support "false"/,
      ],
      [
        "a flag outside the cache-paths schema",
        ["--binary", "tsgo"],
        /cache paths does not support "--binary"/,
      ],
      [
        "an unknown flag",
        ["--not-a-real-cache-option"],
        /cache paths does not support "--not-a-real-cache-option"/,
      ],
    ] as const) {
      const refused = cachePaths([...argv]);
      check(`cache paths refuses ${name}`, () => {
        assert.notEqual(refused.status, 0);
        assert.match(refused.stderr, expected);
      });
    }

    if (!runWatch) {
      if (failures.length)
        throw new AggregateError(
          failures,
          "shared compiler Program boundaries failed",
        );
      return;
    }

    const sourceConfig = fs.readFileSync(path.join(root, "tsconfig.json"));
    const sourceArtifact = spawn(
      process.execPath,
      [
        "--import",
        "./config/register-unit-loader.mjs",
        path.join(
          workspaceRoot,
          "tests/test-e2e/src/internal/ttsc/internal/runSourceCompilerProvenanceCorpus.ts",
        ),
        root,
        tsgoBinary,
      ],
      { cwd: workspaceRoot },
    );
    check("source-artifact native ownership corpus", () => {
      assert.equal(
        sourceArtifact.status,
        0,
        sourceArtifact.stdout + sourceArtifact.stderr,
      );
      assert.equal(sourceArtifact.signal, null);
      assert.equal(sourceArtifact.stderr, "");
      const result = JSON.parse(sourceArtifact.stdout);
      assert.deepEqual(
        result.sourceArtifactReceipts
          .slice(0, 7)
          .map((receipt: { name: string }) => receipt.name),
        [
          "source native producer / preserve",
          "source native producer / react",
          "source native producer / react-native",
          "source native producer / react-jsx",
          "source native producer / react-jsxdev",
          "source positional react-native / src/provenance-view.tsx",
          "source positional react-native / src/provenance-peer.jsx",
        ],
      );
      assert.equal(result.sourceArtifactReceipts.length, 14);
      for (const receipt of result.sourceArtifactReceipts)
        assert.equal(receipt.passed, true, receipt.error ?? receipt.name);
    });
    // A failed producer may still have restored every owned input. Conversely,
    // an exited child alone cannot prove that another host may reuse its root.
    let sourceInputsReleased = false;
    check("source-artifact child releases canonical inputs", () => {
      assert.notEqual(sourceArtifact.status, null);
      assert.equal(sourceArtifact.signal, null);
      assert.deepEqual(
        fs.readFileSync(path.join(root, "tsconfig.json")),
        sourceConfig,
      );
      for (const filename of [
        "src/provenance-view.tsx",
        "src/provenance-peer.jsx",
        "src/provenance-env.d.ts",
        "provenance-react.rsp",
        "provenance-auto.rsp",
        ".source-provenance-output",
      ])
        assert.equal(
          inputEntryAbsent(path.join(root, filename)),
          true,
          filename,
        );
      sourceInputsReleased = true;
    });
    if (!sourceInputsReleased) {
      ownershipProved = false;
      throw new AggregateError(
        failures,
        "source-artifact input release was not proved",
      );
    }
    reset();
    const watchInputs = FixtureFiles.read("ttsc/compiler/watch/watch-inputs");
    for (const [name, contents] of Object.entries(watchInputs)) {
      const target = path.join(
        root,
        name === "external.ts" ? "src/watch-external.ts" : name,
      );
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
    const watchConfig = fs.readFileSync(
      path.join(root, "tsconfig.json"),
      "utf8",
    );
    ownershipProved = false;
    const session = new WatchSession(link, {
      ownershipRoot: workspace,
      watchFlag: "--Watch",
    });
    const observe = async (
      name: string,
      action: () => Promise<void>,
    ): Promise<void> => {
      try {
        await action();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };
    const mutate = async (
      action: () => void,
      host = session,
    ): Promise<string> => {
      await host.waitForSettled();
      await host.waitForQuiet();
      const before = host.transcript();
      const count =
        before.match(/\[ttsc\] watch build (?:complete|failed)/g)?.length ?? 0;
      action();
      await host.waitForBuilds(count + 1);
      await host.waitForSettled();
      return host.transcript().slice(before.length);
    };
    try {
      await observe("watch startup through linked cwd", async () => {
        await session.waitForBuilds(1);
        assert.ok(
          session.transcript().split(/\r?\n/).includes("[ttsc] watching ."),
          session.transcript(),
        );
        assert.equal(
          /Starting compilation in watch mode/.test(session.transcript()),
          false,
        );
        assert.match(session.transcript(), /\[ttsc\] watch build complete/);
        assert.equal(
          fs.existsSync(path.join(root, "build/project/src/main.js")),
          true,
        );
        await session.waitForQuiet();
      });
      await observe(
        "watch switches to analysis without replacing its project",
        async () => {
          const config = JSON.parse(watchConfig);
          config.compilerOptions.noEmit = true;
          assert.match(
            await mutate(() =>
              fs.writeFileSync(
                path.join(root, "tsconfig.json"),
                JSON.stringify(config),
              ),
            ),
            /\[ttsc\] watch build complete/,
          );
        },
      );
      for (const [name, file, contents] of [
        [
          "external extended config",
          path.join(workspace, "support/base.json"),
          '{"compilerOptions":{"module":"commonjs","strict":false,"target":"ES2022"}}',
        ],
        [
          "external loaded source",
          path.join(workspace, "support/dependency/value.ts"),
          "export const value = 2;\n",
        ],
        [
          "external project reference",
          path.join(workspace, "support/reference/src/value.ts"),
          "export const value = 2;\n",
        ],
        [
          "included lib source",
          path.join(root, "lib/value.ts"),
          "export const libValue = 2;\n",
        ],
        [
          "included dist source",
          path.join(root, "dist/value.ts"),
          "export const distValue = 2;\n",
        ],
      ] as const) {
        await observe(name, async () => {
          const transcript = await mutate(() =>
            fs.writeFileSync(file, contents),
          );
          assert.match(transcript, /\[ttsc\] watch build complete/);
        });
      }
      await observe("new included directory registration", async () => {
        const file = path.join(root, "src/later/value.ts");
        assert.match(
          await mutate(() => {
            fs.mkdirSync(path.dirname(file));
            fs.writeFileSync(file, "export const later = 1;\n");
          }),
          /\[ttsc\] watch build complete/,
        );
        assert.match(
          await mutate(() =>
            fs.writeFileSync(file, "export const later = 2;\n"),
          ),
          /\[ttsc\] watch build complete/,
        );
      });
      await observe("unrelated README does not rebuild", async () => {
        await session.waitForSettled();
        await session.waitForQuiet();
        fs.writeFileSync(path.join(root, "README.md"), "changed\n");
        await session.waitForQuiet();
      });
      await observe(
        "throwing config rebuild names failure and recovers",
        async () => {
          const tsconfig = path.join(root, "tsconfig.json");
          const broken = await mutate(() =>
            fs.writeFileSync(tsconfig, "{ this is not valid json"),
          );
          assert.match(broken, /ttsc: failed to parse/);
          assert.equal(broken.includes(tsconfig), true, broken);
          assert.match(broken, /\[ttsc\] watch build failed/);
          assert.doesNotMatch(
            broken,
            /at .*runOnce|Uncaught|UnhandledPromiseRejection/,
          );
          assert.match(
            await mutate(() => fs.writeFileSync(tsconfig, watchConfig)),
            /\[ttsc\] watch build complete/,
          );
        },
      );
      await observe(
        "last failed build survives through owned IPC shutdown",
        async () => {
          assert.match(
            await mutate(() =>
              fs.writeFileSync(
                path.join(root, "src/watch-failure.ts"),
                'export const bad: number = "not a number";\n',
              ),
            ),
            /TS2322/,
          );
          assert.match(
            await mutate(() =>
              fs.rmSync(path.join(root, "src/watch-failure.ts")),
            ),
            /\[ttsc\] watch build complete/,
          );
          assert.match(
            await mutate(() =>
              fs.writeFileSync(
                path.join(root, "tsconfig.json"),
                "{ invalid final config",
              ),
            ),
            /\[ttsc\] watch build failed/,
          );
        },
      );
    } finally {
      await observe("watch launcher and native hosts join", async () => {
        await session.close();
        ownershipProved = true;
        const exit = session.exitResult();
        assert.equal(exit?.signal, null);
        assert.notEqual(exit?.code, 0);
        assert.equal(typeof exit?.code, "number");
      });
    }
    // Whether outDir exists before the first registration is a cold input,
    // so this second host deliberately preserves that separate initial state.
    if (ownershipProved) {
      fs.rmSync(path.join(root, "src/watch-failure.ts"), { force: true });
      const config = JSON.parse(watchConfig);
      config.compilerOptions.outDir = "preexisting-build";
      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify(config),
      );
      fs.mkdirSync(path.join(root, "preexisting-build"));
      fs.writeFileSync(path.join(root, "preexisting-build/.keep"), "");
      ownershipProved = false;
      const preexisting = new WatchSession(link, { ownershipRoot: workspace });
      try {
        await observe(
          "watch excludes an outDir present before startup",
          async () => {
            await preexisting.waitForBuilds(1);
            assert.equal(
              fs.existsSync(
                path.join(root, "preexisting-build/project/src/main.js"),
              ),
              true,
            );
            await preexisting.waitForSettled();
            await preexisting.waitForQuiet();
          },
        );
        const profiles = FixtureFiles.read(
          "ttsc/compiler/watch/output-profiles",
        );
        for (const [name, expected, forbidden] of [
          [
            "external-declaration",
            path.join(workspace, "support/output-source.d.ts"),
            undefined,
          ],
          ["jsx-adjacent", path.join(root, "src/output-input.js"), undefined],
          [
            "incremental-bundle",
            path.join(root, "tsconfig.tsbuildinfo"),
            path.join(root, "dist/bundle.tsbuildinfo"),
          ],
        ] as const) {
          if (name === "incremental-bundle") {
            await observe(
              "watch rejects removed AMD and outFile options",
              async () => {
                const rejected = await mutate(
                  () =>
                    fs.writeFileSync(
                      path.join(root, "tsconfig.json"),
                      JSON.stringify({
                        compilerOptions: {
                          incremental: true,
                          module: "amd",
                          outFile: "dist/bundle.js",
                        },
                        files: ["src/bundle-input.ts"],
                      }),
                    ),
                  preexisting,
                );
                check("removed AMD has its native diagnostic", () => {
                  assert.match(
                    rejected,
                    /TS5108: Option 'module=AMD' has been removed/,
                  );
                });
                check("removed outFile has its native diagnostic", () => {
                  assert.match(
                    rejected,
                    /TS5102: Option 'outFile' has been removed/,
                  );
                });
                check("removed bundle profile reports a failed build", () => {
                  assert.match(rejected, /\[ttsc\] watch build failed/);
                });
                check("removed bundle profile publishes no bundle", () => {
                  assert.equal(
                    fs.existsSync(path.join(root, "dist/bundle.js")),
                    false,
                  );
                });
              },
            );
            // Incremental diagnostics may still publish build metadata. Reset
            // only this owned product so the supported profile must create it
            // cold rather than inherit the rejected configuration's result.
            fs.rmSync(expected, { force: true });
          }
          await observe(
            `watch reconciles native output boundary / ${name}`,
            async () => {
              const profile = profiles[`${name}.json`];
              if (profile === undefined)
                throw new Error(
                  "Missing authored watch output profile: " + name,
                );
              assert.equal(
                fs.existsSync(expected),
                false,
                "output must be cold before profile selection",
              );
              assert.match(
                await mutate(
                  () =>
                    fs.writeFileSync(path.join(root, "tsconfig.json"), profile),
                  preexisting,
                ),
                /\[ttsc\] watch build complete/,
              );
              assert.equal(
                fs.existsSync(expected),
                true,
                preexisting.transcript(),
              );
              if (forbidden !== undefined)
                assert.equal(fs.existsSync(forbidden), false);
              if (name === "incremental-bundle")
                assert.equal(
                  fs.existsSync(path.join(root, "dist/bundle-input.js")),
                  true,
                );
              await preexisting.waitForQuiet();
            },
          );
        }
      } finally {
        await observe("preexisting-output host joins", async () => {
          await preexisting.close();
          ownershipProved = true;
          assert.deepEqual(preexisting.exitResult(), { code: 0, signal: null });
        });
      }
    }
    if (ownershipProved) {
      const positional = FixtureFiles.read(
        "ttsc/compiler/watch/positional-inputs",
      );
      for (const [name, contents] of Object.entries(positional))
        fs.writeFileSync(path.join(root, "src", name), contents);
      const initialView = fs.readFileSync(
        path.join(root, "src/view.tsx"),
        "utf8",
      );
      const profiles = FixtureFiles.read(
        "ttsc/compiler/watch/positional-profiles",
      );
      const select = (
        name: string,
        options: Record<string, unknown> = {},
      ): void => {
        const contents = profiles[`${name}.json`];
        if (contents === undefined)
          throw new Error("Missing authored positional profile: " + name);
        const config = JSON.parse(contents);
        Object.assign(config.compilerOptions, options);
        fs.writeFileSync(
          path.join(root, "tsconfig.json"),
          JSON.stringify(config),
        );
      };
      select("configured-preserve");
      const configured = spawn(
        ttscBin,
        ["--cwd", root, "--pretty", "src/view.tsx"],
        {
          cwd: root,
        },
      );
      check("positional configured preserve copies only JSX", () => {
        assert.equal(
          configured.status,
          0,
          configured.stdout + configured.stderr,
        );
        assert.equal(
          /TS5042/.test(configured.stdout + configured.stderr),
          false,
        );
        assert.equal(fs.existsSync(path.join(root, "dist/view.jsx")), true);
        assert.equal(fs.existsSync(path.join(root, "dist/view.js")), false);
      });
      fs.rmSync(path.join(root, "dist/view.jsx"), { force: true });
      for (const [profile, mode, extension, absent] of [
        ["adjacent-preserve", "react-native", "js", "jsx"],
        ["adjacent-transform", "preserve", "jsx", "js"],
      ] as const) {
        if (!ownershipProved) break;
        select(profile, mode === "react-native" ? { strict: false } : {});
        for (const extension of ["js", "jsx"])
          fs.rmSync(path.join(root, `src/view.${extension}`), { force: true });
        ownershipProved = false;
        const jsx = new WatchSession(root, {
          args: [
            "--jsx",
            mode,
            ...(mode === "react-native" ? ["--strict"] : []),
            "src/view.tsx",
          ],
          ownershipRoot: workspace,
        });
        try {
          await observe(
            `positional watch overrides configured JSX / ${mode}`,
            async () => {
              await jsx.waitForBuilds(1);
              assert.match(jsx.transcript(), /\[ttsc\] watch build complete/);
              assert.equal(
                fs.existsSync(path.join(root, `src/view.${extension}`)),
                true,
                jsx.transcript(),
              );
              assert.equal(
                fs.existsSync(path.join(root, `src/view.${absent}`)),
                false,
                jsx.transcript(),
              );
              await jsx.waitForQuiet();
              if (mode === "react-native") {
                const source = path.join(root, "src/view.tsx");
                const before = fs.readFileSync(source, "utf8");
                fs.rmSync(path.join(root, "src/view.js"));
                const failed = await mutate(
                  () =>
                    fs.writeFileSync(
                      source,
                      before +
                        "\nexport const len = (x: string | null): number => x.length;\n",
                    ),
                  jsx,
                );
                assert.match(failed, /is possibly .?null/i);
                assert.match(failed, /\[ttsc\] watch build failed/);
                assert.equal(
                  fs.existsSync(path.join(root, "src/view.js")),
                  false,
                );
                assert.match(
                  await mutate(() => fs.writeFileSync(source, before), jsx),
                  /\[ttsc\] watch build complete/,
                );
                assert.equal(
                  fs.existsSync(path.join(root, "src/view.js")),
                  true,
                );
              }
            },
          );
        } finally {
          await observe(`positional JSX host joins / ${mode}`, async () => {
            await jsx.close();
            ownershipProved = true;
            assert.deepEqual(jsx.exitResult(), { code: 0, signal: null });
          });
        }
        if (ownershipProved) {
          fs.writeFileSync(path.join(root, "src/view.tsx"), initialView);
          fs.rmSync(path.join(root, `src/view.${extension}`), { force: true });
        }
      }
      const main = path.join(root, "src/main.ts");
      const initialAnalysis = fs.readFileSync(
        path.join(root, "layout-inputs/configured-noemit.ts"),
        "utf8",
      );
      for (const args of [
        ["--noEmit", "src/broken.ts"],
        ["check", "--strict", "src/main.ts"],
      ]) {
        if (!ownershipProved) break;
        const input = path.join(root, args[args.length - 1]!);
        if (args[0] === "--noEmit" && !inputEntryAbsent(input)) {
          ownershipProved = false;
          check("analysis broken source must own a fresh path", () =>
            assert.fail("src/broken.ts already exists"),
          );
          break;
        }
        select("emitting-main", { strict: false });
        const selectedConfig = JSON.parse(
          fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
        );
        selectedConfig.files = [args[args.length - 1]!];
        fs.writeFileSync(
          path.join(root, "tsconfig.json"),
          JSON.stringify(selectedConfig),
        );
        try {
          fs.writeFileSync(
            input,
            initialAnalysis,
            args[0] === "--noEmit" ? { flag: "wx" } : undefined,
          );
        } catch (error) {
          ownershipProved = false;
          throw error;
        }
        let analysisInputBytes = initialAnalysis;
        const writeAnalysis = (contents: string): void => {
          fs.writeFileSync(input, contents);
          analysisInputBytes = contents;
        };
        const expected = path.join(
          root,
          "dist",
          path.basename(input, ".ts") + ".js",
        );
        check(
          `positional analysis starts without inherited output / ${args[0]}`,
          () => {
            assert.equal(
              fs.existsSync(expected),
              false,
              "analysis output must start absent",
            );
          },
        );
        fs.rmSync(expected, { force: true });
        ownershipProved = false;
        const analysis = new WatchSession(root, {
          args,
          ownershipRoot: workspace,
        });
        try {
          await observe(
            `positional analysis watch initial and rebuild / ${args[0]}`,
            async () => {
              await analysis.waitForBuilds(1);
              check(`analysis initial success / ${args[0]}`, () =>
                assert.match(
                  analysis.transcript(),
                  /\[ttsc\] watch build complete/,
                ),
              );
              check(`analysis initial output absence / ${args[0]}`, () =>
                assert.equal(
                  fs.existsSync(expected),
                  false,
                  analysis.transcript(),
                ),
              );
              check(
                `analysis initial emitted-path stdout absence / ${args[0]}`,
                () =>
                  assert.equal(analysis.transcript().includes("dist"), false),
              );
              if (args[0] === "check") {
                const failed = await mutate(
                  () =>
                    writeAnalysis(
                      "export const len = (x: string | null): number => x.length;\n",
                    ),
                  analysis,
                );
                assert.match(failed, /is possibly .?null/i);
                assert.match(failed, /\[ttsc\] watch build failed/);
                assert.equal(fs.existsSync(expected), false);
                assert.match(
                  await mutate(() => writeAnalysis(initialAnalysis), analysis),
                  /\[ttsc\] watch build complete/,
                );
                assert.equal(fs.existsSync(expected), false);
              }
              const rebuilt = await mutate(
                () => writeAnalysis("export const value: number = 2;\n"),
                analysis,
              );
              check(
                `analysis authored value2 successful rebuild / ${args[0]}`,
                () => assert.match(rebuilt, /\[ttsc\] watch build complete/),
              );
              check(`analysis rebuilt output absence / ${args[0]}`, () =>
                assert.equal(
                  fs.existsSync(expected),
                  false,
                  analysis.transcript(),
                ),
              );
              if (args[0] === "--noEmit") {
                const failed = await mutate(
                  () =>
                    writeAnalysis('const value: number = "not a number";\n'),
                  analysis,
                );
                check("noEmit invalid assignment diagnostic", () =>
                  assert.match(failed, /TS2322/),
                );
                check("noEmit invalid assignment failed build", () =>
                  assert.match(failed, /\[ttsc\] watch build failed/),
                );
                check("noEmit invalid assignment broken.js absence", () =>
                  assert.equal(fs.existsSync(expected), false),
                );
              }
            },
          );
        } finally {
          await observe(
            `positional analysis host joins / ${args[0]}`,
            async () => {
              await analysis.close();
              ownershipProved = true;
              const exit = analysis.exitResult();
              assert.equal(exit?.signal, null);
              assert.equal(typeof exit?.code, "number");
              if (args[0] === "--noEmit") assert.equal(exit?.code, 2);
              else assert.equal(exit?.code, 0);
              assert.equal(fs.existsSync(expected), false);
            },
          );
        }
        if (ownershipProved && args[0] === "--noEmit") {
          await observe("release owned analysis broken source", async () => {
            try {
              assert.equal(fs.lstatSync(input).isFile(), true);
              assert.equal(fs.readFileSync(input, "utf8"), analysisInputBytes);
              fs.rmSync(input);
              assert.equal(inputEntryAbsent(input), true);
            } catch (error) {
              ownershipProved = false;
              throw error;
            }
          });
        }
      }
      if (ownershipProved && process.platform !== "win32") {
        select("emitting-main");
        fs.writeFileSync(
          main,
          'export const value: number = "not a number";\n',
        );
        await observe(
          "failed project build preserves actual SIGTERM transport",
          async () => {
            ownershipProved = false;
            const child = child_process.spawn(
              process.execPath,
              [ttscBin, "--watch", "--preserveWatchOutput", "--cwd", root],
              {
                cwd: root,
                env: {
                  ...process.env,
                  TTSC_BINARY: nativeBinary,
                  TTSC_TSGO_BINARY: tsgoBinary,
                },
                stdio: ["ignore", "pipe", "pipe"],
                windowsHide: true,
              },
            );
            let transcript = "";
            let requested = false;
            let forced = false;
            let startupError: Error | undefined;
            const exit = new Promise<{
              code: number | null;
              signal: NodeJS.Signals | null;
            }>((resolve) => {
              const timer = setTimeout(() => {
                forced = true;
                child.kill("SIGKILL");
              }, 120_000);
              child.once("error", (error) => {
                startupError = error;
              });
              child.once("close", (code, signal) => {
                clearTimeout(timer);
                resolve({ code, signal });
              });
            });
            const onChunk = (chunk: Buffer): void => {
              transcript += chunk.toString("utf8");
              if (
                !requested &&
                /TS2322/.test(transcript) &&
                /\[ttsc\] watch build failed/.test(transcript)
              ) {
                requested = true;
                child.kill("SIGTERM");
              }
            };
            child.stdout?.on("data", onChunk);
            child.stderr?.on("data", onChunk);
            const result = await exit;
            // This plugin-free project's synchronous native compile has already
            // exited before the failed marker. Handled SIGTERM and actual stdio
            // close then establish the remaining launcher's closure.
            ownershipProved =
              requested &&
              !forced &&
              startupError === undefined &&
              result.signal === null;
            assert.equal(startupError, undefined);
            assert.equal(forced, false, transcript);
            assert.equal(requested, true, transcript);
            assert.match(transcript, /TS2322/);
            assert.equal(result.signal, null, transcript);
            assert.equal(typeof result.code, "number", transcript);
            assert.notEqual(result.code, 0, transcript);
          },
        );
      }
    }
  } finally {
    if (ownershipProved)
      fs.rmSync(workspace, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    else
      TestProject.retainTemporaryDirectory(
        workspace,
        "Shared compiler watch did not prove native closure",
      );
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "shared compiler Program boundaries failed",
    );
}

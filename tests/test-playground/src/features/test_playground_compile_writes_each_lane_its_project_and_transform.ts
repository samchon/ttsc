import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
 * Verifies compile and bundle write the project each lane needs, hand typia the
 * documented plugin request, and accept only a well-formed transform output.
 *
 * The compile lane previews ES modules and the bundle lane feeds a CommonJS
 * `new Function` driver, so the tsconfig written before each build must differ
 * only in its module kind. The transform rewrites files by virtual path, so a
 * relative path resolves under the work directory while an absolute one stays,
 * and a stdout that is not the documented shape must fail the build.
 *
 * 1. Compile and bundle with defaults, then with a custom work directory, tsconfig
 *    path, entry file, plugin name and extra compiler options, and read the
 *    recorded writes, plugin request and build request.
 * 2. Turn typia off for the service and for one call, and observe the tsconfig and
 *    the plugin log.
 * 3. Feed the transform a relative and an absolute path, a non-string value, an
 *    array, a missing `typescript` object and null, and a nonzero exit with
 *    padded and empty output streams.
 *
 * @evidence contracts/testing.md#behavioral-verification createWorkerCompilerService.compile and bundle write an ESNext or CommonJS tsconfig plus the entry source at the configured paths, send typia the transform request for the work directory, skip the transform when disabled, resolve relative transform paths under the work directory and keep absolute ones, and fail on a malformed transform output or a nonzero exit with the right message. The recorded writes, plugin request and build request, compared literally, reject a lane that shares or mislabels the module kind.
 * @evidence contracts/testing.md#independent-expectations The tsconfig keys follow the documented defaults (ESNext target, Bundler resolution, strict, outDir dist, rootDir src, include src) and the module kind is the lane's contract; the typia plugin entry is the documented `transform` module. Failure message precedence (trimmed stderr, then trimmed stdout, then the fixed sentence with the exit code) is authored from the service documentation, not computed from its output.
 * @evidence contracts/testing.md#distinguishing-cases Default and fully customized paths, typia on and off at service and call level, an ESNext lane against a CommonJS lane, relative against absolute transform paths, and six malformed outputs each contrast with the valid shape. Extra compiler options that collide with a default must win, while the others merge.
 * @evidence contracts/testing.md#execution-ownership This entry owns every makeFakeWorker instance and parses the tsconfig text the real createWorkerCompilerService writes into the injected host double, in the unit process; no WASM runtime, MemFS or compiler process runs. The transform's JSON envelope handling for success and rejection is shared with the test_playground_plugin_failure_* entries.
 */
export const test_playground_compile_writes_each_lane_its_project_and_transform =
  async (): Promise<void> => {
    const source = "export const x = 1;";
    const okBuild = () =>
      envelope({ result: compilePayload({ "src/playground.js": "x = 1;" }) });

    // Default layout, both lanes.
    {
      const { service, record } = makeFakeWorker(
        { ...BASE_OPTIONS, typiaPlugin: false, lintPlugin: false },
        { build: okBuild },
      );
      await service.compile({ source });
      const esm = JSON.parse(record.writes["/work/tsconfig.json"]!);
      assert.equal(record.writes["/work/src/playground.ts"], source);
      assert.deepEqual(esm, {
        compilerOptions: {
          target: "ESNext",
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          moduleResolution: "Bundler",
          strict: true,
          skipLibCheck: true,
          experimentalDecorators: true,
          module: "ESNext",
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      });
      await service.bundle({ source });
      const cjs = JSON.parse(record.writes["/work/tsconfig.json"]!);
      assert.deepEqual(
        {
          ...cjs,
          compilerOptions: { ...cjs.compilerOptions, module: "ESNext" },
        },
        esm,
        "the lanes differ only in the module kind",
      );
      assert.equal(cjs.compilerOptions.module, "CommonJS");
      assert.deepEqual(record.build, [
        { cwd: "/work", tsconfig: "tsconfig.json" },
        { cwd: "/work", tsconfig: "tsconfig.json" },
      ]);
      assert.equal(record.plugin.length, 0, "typia off never runs a transform");
    }

    // Customized layout with typia on.
    {
      const { service, record } = makeFakeWorker(
        {
          ...BASE_OPTIONS,
          workDir: "/proj",
          tsconfigPath: "cfg/tsconfig.app.json",
          entryFile: "app/main.ts",
          typiaPlugin: { name: "my-typia", transformModule: "my/transform" },
          lintPlugin: false,
          extraCompilerOptions: { strict: false, lib: ["ES2022"] },
        },
        { build: okBuild },
      );
      await service.compile({ source });
      assert.equal(record.writes["/proj/app/main.ts"], source);
      const written = JSON.parse(record.writes["/proj/cfg/tsconfig.app.json"]!);
      assert.equal(
        written.compilerOptions.strict,
        false,
        "an extra option wins",
      );
      assert.deepEqual(written.compilerOptions.lib, ["ES2022"]);
      assert.equal(written.compilerOptions.moduleResolution, "Bundler");
      assert.deepEqual(written.compilerOptions.plugins, [
        { transform: "my/transform" },
      ]);
      assert.deepEqual(record.plugin, [
        {
          name: "my-typia",
          command: "transform",
          cwd: "/proj",
          tsconfig: "cfg/tsconfig.app.json",
          output: "ts",
        },
      ]);
      assert.deepEqual(record.build, [
        { cwd: "/proj", tsconfig: "cfg/tsconfig.app.json" },
      ]);

      await service.compile({ source, options: { typia: false } });
      assert.equal(record.plugin.length, 1, "a call can skip the transform");
      assert.equal(record.build.length, 2, "and still builds");
    }

    // Default typia plugin entry.
    {
      const { service, record } = makeFakeWorker(
        { ...BASE_OPTIONS, lintPlugin: false },
        { build: okBuild },
      );
      await service.compile({ source });
      const written = JSON.parse(record.writes["/work/tsconfig.json"]!);
      assert.deepEqual(written.compilerOptions.plugins, [
        { transform: "typia/lib/transform" },
      ]);
      assert.equal(record.plugin[0]?.name, "typia");
    }

    // Transform output shapes.
    {
      const transformed = (stdout: string) =>
        makeFakeWorker(
          { ...BASE_OPTIONS, lintPlugin: false },
          { plugin: () => envelope({ stdout }), build: okBuild },
        );
      const good = transformed(
        JSON.stringify({
          typescript: {
            "src/playground.ts": "REWRITTEN",
            "/abs/extra.ts": "ABSOLUTE",
          },
        }),
      );
      const result = await good.service.compile({ source });
      assert.equal(result.type, "success");
      assert.equal(good.record.writes["/work/src/playground.ts"], "REWRITTEN");
      assert.equal(good.record.writes["/abs/extra.ts"], "ABSOLUTE");
      assert.equal(good.record.writes["/work//abs/extra.ts"], undefined);

      const malformed = [
        '{"typescript":{"src/playground.ts":1}}',
        '{"typescript":[]}',
        '{"typescript":null}',
        '{"other":{}}',
        "[]",
        "null",
      ];
      for (const stdout of malformed) {
        const bad = transformed(stdout);
        const failed = await bad.service.compile({ source });
        assert.deepEqual(
          failed,
          {
            type: "error",
            target: "javascript",
            value: {
              message: "ttsc: typia transform produced unparseable output",
            },
          },
          stdout,
        );
        assert.equal(bad.record.build.length, 0, `${stdout} never builds`);
      }
    }

    // Nonzero transform exit: message precedence.
    {
      const messageFor = async (over: Parameters<typeof envelope>[0]) => {
        const { service } = makeFakeWorker(
          { ...BASE_OPTIONS, lintPlugin: false },
          { plugin: () => envelope({ code: 3, ...over }), build: okBuild },
        );
        const result = await service.compile({ source });
        assert.equal(result.type, "error");
        return (result.value as { message: string }).message;
      };
      assert.equal(
        await messageFor({ stderr: "  err text \n", stdout: "out text" }),
        "err text",
      );
      assert.equal(
        await messageFor({ stderr: "  \n", stdout: "  out text  " }),
        "out text",
      );
      assert.equal(
        await messageFor({}),
        "ttsc: typia transform plugin failed (exit code 3)",
      );
    }
  };

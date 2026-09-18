import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies positional `ttsc <file>` refuses a file its project does not
 * compile, instead of writing another file's JavaScript under its name.
 *
 * Pins samchon/ttsc#1382 row 7. The single-file lane builds the whole project
 * into a private directory and then looks up the requested file's output. For
 * `scripts/index.ts` outside `include: ["src"]` there is none, and the lookup
 * used to score `src/index.js` by its shared `index` name: `ttsc
 * scripts/index.ts` wrote `lib/scripts/index.js` containing `src/index.ts`'s
 * code and exited 0. The lookup now also mirrors against the pinned `rootDir`,
 * where it previously used the project root, so a project that declares
 * `rootDir` never needed the name match in the first place.
 *
 * 1. Create a project with `include: ["src"]`, `outDir: "lib"`, and both
 *    `src/index.ts` and `scripts/index.ts`.
 * 2. Run `ttsc scripts/index.ts`, then `ttsc src/index.ts`.
 * 3. Assert the first fails naming the file and the tsconfig and writes nothing,
 *    and the second emits `src/index.ts`'s own code.
 */
export const test_ttsc_single_file_refuses_a_file_outside_the_project_file_set =
  (): void => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "lib",
          target: "ES2022",
          types: [],
        },
        include: ["src"],
      }),
      "src/index.ts": `console.log("ran src/index.ts");\nexport {};\n`,
      "scripts/index.ts": `console.log("ran scripts/index.ts");\nexport {};\n`,
    });

    const refused = spawn(ttscBin, ["--cwd", root, "scripts/index.ts"], {
      cwd: root,
    });
    assert.notEqual(refused.status, 0, refused.stdout);
    assert.match(
      refused.stderr,
      /scripts[\\/]index\.ts is not part of the program of .*tsconfig\.json/,
    );
    assert.equal(fs.existsSync(path.join(root, "lib")), false);

    const emitted = spawn(ttscBin, ["--cwd", root, "src/index.ts"], {
      cwd: root,
    });
    assert.equal(emitted.status, 0, `${emitted.stdout}${emitted.stderr}`);
    const output = fs.readFileSync(
      path.join(root, "lib", "src", "index.js"),
      "utf8",
    );
    assert.match(output, /ran src\/index\.ts/);
    assert.doesNotMatch(output, /ran scripts/);
  };

import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies `emitDecoratorMetadata` does not make a transform output
 * type-dependent.
 *
 * This is the exception samchon/ttsc#1259 named, and checking it is what turns
 * the completeness rule from an assumption into a verified one: `design:type`
 * metadata comes from the Checker, so a file carrying it would depend on every
 * type it mentions. It never reaches a transform envelope, because that
 * lowering belongs to the emit chain the `build` lane runs and this lane
 * answers with the file's parsed text instead.
 *
 * 1. Create a plugin-free project with `experimentalDecorators` and
 *    `emitDecoratorMetadata` whose entry decorates a method with an imported
 *    parameter type.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the output carries no emitted metadata and that the file is still
 *    declared complete.
 */
export const test_ttsccompiler_transform_declares_a_decorated_file_complete =
  () => {
    const root = createProject({
      compilerOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
      files: {
        "src/types.ts": "export class Payload {\n  public id!: string;\n}\n",
      },
      source: [
        'import { Payload } from "./types";',
        "",
        "const log = (): MethodDecorator => () => undefined;",
        "",
        "export class Service {",
        "  @log()",
        "  public accept(payload: Payload): string {",
        "    return payload.id;",
        "  }",
        "}",
        "",
      ].join("\n"),
    });
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.equal(
      result.typescript["src/main.ts"]?.includes("design:type"),
      false,
    );
    assert.deepEqual(result.dependenciesComplete, [
      "src/main.ts",
      "src/types.ts",
    ]);
  };

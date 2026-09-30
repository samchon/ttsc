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
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms a legacy decorated method using imported Payload with metadata flags enabled; checks no design:type text and exact completeness entries for main.ts and types.ts.
 * @evidence contracts/testing.md#independent-expectations Source-only transform returns parsed TypeScript before emit decorator lowering; the authored two-file project establishes the exact completeness list independently.
 * @evidence contracts/testing.md#distinguishing-cases The metadata-enabled decorated input is the exceptional type-dependent emit case; the no-plugin ordinary type-import case checks the nondecorated positive separately.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named feature and executes the actual native transform producer.
 * @evidence contracts/e2e.md#necessary-boundary The producer must report completeness while withholding emit-chain decorator metadata in its source envelope; a decoder unit cannot prove the native lane chooses parsed text.
 * @evidence contracts/e2e.md#shared-execution One plugin-free transform supplies both metadata absence and completeness checks, with the suite sharing its package build and resolved compiler executable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered project owns both source files and metadata flags, and no source/result cache is shared between cases. Synchronous transform ends its process and fixture cleanup runs at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Original success, absent design:type and exact two-path completeness list remain; emitted decorator runtime behavior is covered elsewhere, not inferred here.
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

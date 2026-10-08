/**
 * Everything a fixture needs to become a real project on disk.
 *
 * The optional members exist because a consumer's own setup is part of what a
 * rule has to survive. Program membership and compiler settings are not fixture
 * details to be assumed away — they decide which files a rule ever sees, and
 * whether an import that exists only to support a citation is legal at all.
 *
 * @evidence contracts/common.md#principled-implementation The contract carries original file/config/compiler inputs and an explicit producer identity choice; omitted nativeProducer retains live workspace source so source-mutation boundaries are not silently snapshotted.
 * @evidence contracts/common.md#clear-and-simple-design One readonly preparation input owns project-relative versus workspace-relative files, compiler membership/settings and the two producer choices without duplicating package resolution policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No input declares a successful compiler result, native capability or cache proof; snapshot selection asks the real preparation owner to resolve its verified package, not a fabricated binary.
 * @evidence contracts/common.md#meaningful-documentation Fields explain relative roots, original compiler membership and producer default semantics so callers can choose which state their boundary actually observes.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Project-relative and ancestor-workspace-relative file maps remain distinct from native absolute module/parent locations; compiler options are passed unchanged to the actual compiler.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ICreateProjectProps defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ICreateProjectProps defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ICreateProjectProps carries data or signatures; acquisition and release remain with the implementing operation.
 */
export interface ICreateProjectProps {
  /** Distinguishes temp directories in a failure report. */
  readonly name: string;

  /**
   * Immutable authored lint package for shared non-mutating consumers. Defaults
   * to the live workspace package so cold/source-mutation boundaries continue
   * to observe their original producer inputs.
   */
  readonly nativeProducer?: "snapshot" | "workspace";

  /** Caller-prepared compatible dependency tree; never removed by this project. */
  readonly preparedModules?: string;

  /**
   * Common manifest-free owner beneath which this private ancestor workspace
   * lives.
   */
  readonly workspaceParent?: string;

  /** File map, project-relative. Values are written verbatim. */
  readonly files: Readonly<Record<string, string>>;

  /**
   * File map relative to the directory the project sits inside.
   *
   * Where a shared document set, a sibling package's schema, or a generated
   * OpenAPI document goes. A population reaches these through its declared
   * `root`, or a Swagger reference through an ancestor-relative `file` — which
   * is behavior no project-relative fixture can exercise at all.
   */
  readonly workspaceFiles?: Readonly<Record<string, string>>;

  /** Complete `lint.config.ts` source, evaluated by the real config loader. */
  readonly lintConfig: string;

  /**
   * Overrides the generated `tsconfig.json` `include` array.
   *
   * Program membership is a real variable in a consumer's setup, not a fixture
   * detail: a file rule only ever sees what the project includes, so whether
   * `lint.config.ts` is linted at all depends on this array. The default keeps
   * the config file in the program.
   */
  readonly include?: readonly string[];

  /**
   * Extra `compilerOptions` merged over the generated defaults.
   *
   * A consumer's compiler settings are part of what a rule has to survive, not
   * a fixture detail: `noUnusedLocals` decides whether an import that exists
   * only to support a citation is legal at all.
   */
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
}

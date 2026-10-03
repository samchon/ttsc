import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";
import type { ITtscProjectIdentity } from "./ITtscProjectIdentity";

/**
 * Resolved project config subset used inside the ttsc host.
 *
 * @evidence contracts/common.md#principled-implementation Resolved compiler options retain unknown compiler-owned fields, while config ancestry and each plugin's declaring directory preserve distinct inheritance and resolution identities.
 * @evidence contracts/common.md#clear-and-simple-design One resolved project record groups option values and their provenance; lexical/physical identity stays in its shared representation rather than being reconstructed from root alone.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Inherited plugin bases are actual provenance, not package-name path exceptions; unknown compiler options are preserved instead of guessed by the host.
 * @evidence contracts/common.md#meaningful-documentation Native member comments identify ancestry, option normalization, plugin origins and project identity; documented-member and tag spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Per-entry declaring directories and separate lexical/physical-path selections preserve distinct native resolution roles, including the identity resolver's realpath-failure fallback and independent project-root override. Resolved outDir is native absolute path data; parser/path utilities own normalization and filesystem proof.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface ITtscParsedProjectConfig {
  /**
   * Lexical config-selection and inheritance-resolution inputs, including
   * missing candidates.
   */
  configInputs?: readonly string[];

  /**
   * True when config selection uses fully observed file candidates; module
   * inheritance is unproved. Omitted by older/manual records and treated
   * false.
   */
  configInputsComplete?: boolean;

  /** Every resolved tsconfig/jsconfig in the inherited `extends` chain. */
  configPaths: readonly string[];

  /** Compiler options after extends inheritance has been applied. */
  compilerOptions: {
    /** Absolute output directory when configured. */
    outDir?: string;

    /** Project plugin entries after inheritance resolution. */
    plugins: ITtscProjectPluginConfig[];
  } & Record<string, unknown>;

  /** Lexical selections and attempted-realpath results for native contexts. */
  identity: Omit<ITtscProjectIdentity, "pluginConfigOrigin">;

  /** Absolute path to the resolved tsconfig/jsconfig. */
  path: string;

  /** Directory that declared each inherited plugin entry. */
  pluginBaseDirs: string[];

  /**
   * Selected project root from identity resolution: the explicit override when
   * supplied, otherwise the resolved config directory, after attempted realpath.
   */
  root: string;
}

import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { TtscPluginStage } from "../../../structures/TtscPluginStage";

/**
 * Admit an evaluated descriptor object and its supported execution stage.
 * Evaluation, JS-transform rejection and native source acquisition remain
 * separate owners; object admission does not validate every descriptor field.
 *
 * @evidence contracts/common.md#principled-implementation The actual loader uses object admission before its existing JS-function guard and stage selection before native preparation.
 * @evidence contracts/common.md#clear-and-simple-design One descriptor concern groups shape admission and stage defaults/errors without an evaluator abstraction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied evaluated values are not synthetic producer certificates and these members execute no loader.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes shallow shape admission from evaluation and other field validation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This namespace groups supplied-value policies without native filesystem or process operations.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The grouping chooses no input-processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The grouping owns no cached evaluation result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no runtime registry, task or native handle.
 */
export namespace PluginDescriptorAdmission {
  /**
   * Return the same non-null, non-array object or reject the named export.
   * Other field validation remains with the loader's subsequent guards.
   *
   * @evidence contracts/common.md#principled-implementation The former loader predicate admits exactly non-null objects except arrays and preserves admitted reference identity.
   * @evidence contracts/common.md#clear-and-simple-design One return-or-throw boundary owns the actual invalid-export diagnostic.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No descriptor is evaluated or fabricated by this shallow admission.
   * @evidence contracts/common.md#meaningful-documentation Native prose states accepted shape, identity and the remaining field-validation responsibility.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied values and diagnostic text require no native path, file or process operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Scalar shape checks select no growing-population algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Admission uses the current supplied value and owns no evaluation cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The same object returns to the caller; no handle, task or history is retained.
   */
  export function descriptor(value: unknown, specifier: string): ITtscPlugin {
    if (typeof value === "object" && value !== null && !Array.isArray(value))
      return value as ITtscPlugin;
    throw new Error(
      `ttsc: plugin "${specifier}" does not export a valid ttsc plugin`,
    );
  }

  /**
   * Default an omitted stage to transform and reject removed/unknown stages.
   * The removed output stage retains its specific upgrade diagnostic.
   *
   * @evidence contracts/common.md#principled-implementation Omission defaults to transform, transform/check retain their values, and removed output remains distinct from unsupported stage text.
   * @evidence contracts/common.md#clear-and-simple-design Stage selection owns its default and two rejection diagnostics in one supplied-descriptor operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No successful evaluator or native host is inferred from an accepted stage.
   * @evidence contracts/common.md#meaningful-documentation Native prose names the default, admitted stages and removed-stage distinction.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied stage/name values are interpreted without native paths, files or processes.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Scalar stage selection and diagnostic formatting choose no growing-population algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current descriptor fields are read without retained stage-result caching.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This operation retains no descriptor population, handle or task.
   */
  export function stage(plugin: ITtscPlugin): TtscPluginStage {
    if (plugin.stage === undefined) return "transform";
    if (!isPluginStage(plugin.stage)) {
      if (plugin.stage === "output")
        throw new Error(
          `ttsc: plugin "${plugin.name}" requested removed stage "output"; ` +
            "upgrade the plugin to a transform-stage descriptor compatible with this ttsc version",
        );
      throw new Error(
        `ttsc: plugin "${plugin.name}" requested unsupported stage ${JSON.stringify(plugin.stage)}`,
      );
    }
    return plugin.stage;
  }
}

/**
 * Retain the loader's scalar stage predicate without rereading descriptor
 * fields.
 */
function isPluginStage(value: string): value is TtscPluginStage {
  return value === "transform" || value === "check";
}

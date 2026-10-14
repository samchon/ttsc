/**
 * Attribute a package-resolution failure to its plugin and consumer directory.
 *
 * Runtime resolvers can throw objects with an empty message. The request and directory remain actionable independently of that message; the original cause and any string error code remain available to callers.
 *
 * @evidence contracts/common.md#principled-implementation Resolution supplies the actual specifier and consumer directory, so diagnostic context survives an empty runtime message without inferring a cause or changing resolver policy.
 * @evidence contracts/common.md#clear-and-simple-design One error boundary enriches diagnostics while preserving the original cause and a string code.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Error attribution uses every failed request without package-name, runtime-name or message-pattern exceptions.
 * @evidence contracts/common.md#meaningful-documentation The comment states why independent resolution context is necessary and which original failure fields survive.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The function displays caller-supplied strings and performs no filesystem, path-identity or process operation.
 * @evidence contracts/performance.md#efficient-algorithms One diagnostic allocation copies specifier, directory and optional message text; work and storage scale with those strings.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Errors describe the current failed request and own no reusable observation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned error transfers its cause to the caller and owns no native resource or cross-call population.
 */
export function pluginResolutionFailure(
  specifier: string,
  consumerDir: string,
  cause: unknown,
): Error {
  const record =
    typeof cause === "object" && cause !== null
      ? (cause as { code?: unknown; message?: unknown })
      : undefined;
  const message = typeof cause === "string" ? cause : record?.message;
  const detail =
    typeof message === "string" && message.trim() !== "" ? `: ${message}` : "";
  const error = new Error(
    `ttsc: could not resolve plugin ${JSON.stringify(specifier)} from ${JSON.stringify(consumerDir)}${detail}`,
    { cause },
  );
  return typeof record?.code === "string"
    ? Object.assign(error, { code: record.code })
    : error;
}

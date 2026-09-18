import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import { hashText } from "../utils/hashText";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";

/** Compact state of one exact out-of-walk input in a failed generation. */
export function failedGenerationInputState(
  input: string,
  filesystem: TtscTransformFilesystemOperations,
): string {
  let directory = "not-directory";
  try {
    if (filesystem.stat(input).isDirectory()) {
      directory = hashText(
        filesystem
          .readdir(input)
          .map((entry) =>
            [
              entry.name,
              entry.isDirectory(),
              entry.isFile(),
              entry.isSymbolicLink(),
            ].join(":"),
          )
          .sort()
          .join("\0"),
      );
    }
  } catch {
    directory = "unavailable";
  }
  return hashText(
    JSON.stringify([
      inputMetadataSignature(input, filesystem) ?? "missing",
      hostInputStateHash(input, filesystem) ?? MISSING_INPUT_STATE,
      hostInputRealpath(input, filesystem),
      directory,
    ]),
  );
}

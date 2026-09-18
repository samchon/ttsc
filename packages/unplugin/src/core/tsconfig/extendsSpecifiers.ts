/** Normalize the `extends` field into a list of string specifiers. */
export function extendsSpecifiers(extended: unknown): string[] {
  if (typeof extended === "string") {
    return [extended];
  }
  if (Array.isArray(extended)) {
    return extended.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  return [];
}

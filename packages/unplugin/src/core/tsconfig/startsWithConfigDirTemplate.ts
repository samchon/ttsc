/** Match the prefix predicate used by TypeScript-Go before substitution. */
export function startsWithConfigDirTemplate(target: string): boolean {
  const template = "${configDir}";
  return (
    target.slice(0, template.length).toLowerCase() === template.toLowerCase()
  );
}

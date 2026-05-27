import { BUILT_IN_PLAYGROUND_PACKAGES } from "./BUILT_IN_PLAYGROUND_PACKAGES";
import { packageNameFromSpecifier } from "./packageNameFromSpecifier";

const MODULE_SPECIFIER_REGEXP =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Scan `source` for `import` / `require` specifiers and return the unique
 * sorted list of bare npm package names that are not in `ignoredPackages`.
 */
export function collectExternalPackageNames(
  source: string,
  ignoredPackages: Iterable<string> = BUILT_IN_PLAYGROUND_PACKAGES,
): string[] {
  const ignored = new Set(ignoredPackages);
  const found = new Set<string>();
  for (const specifier of collectModuleSpecifiers(source)) {
    const packageName = packageNameFromSpecifier(specifier);
    if (packageName && !ignored.has(packageName)) found.add(packageName);
  }
  return [...found].sort();
}

function collectModuleSpecifiers(source: string): string[] {
  const out: string[] = [];
  MODULE_SPECIFIER_REGEXP.lastIndex = 0;
  for (;;) {
    const match = MODULE_SPECIFIER_REGEXP.exec(source);
    if (!match) break;
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) out.push(specifier);
  }
  return out;
}

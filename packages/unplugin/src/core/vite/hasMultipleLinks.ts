import fs from "node:fs";

/** Whether writes can reach this input through an unobserved hardlink alias. */
export function hasMultipleLinks(file: string): boolean {
  try {
    const stats = fs.statSync(file);
    return stats.isFile() && stats.nlink > 1;
  } catch {
    return false;
  }
}

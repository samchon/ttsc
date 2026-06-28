import fs from "node:fs";
import path from "node:path";
import { Singleton, VariadicSingleton } from "tstl";

export function getLocalSourceFile(location: string): Promise<string> {
  return loader.get(location);
}

const loader = new VariadicSingleton(async (location: string) => {
  const workspace: string = await root.get();
  const absolute: string = path.resolve(workspace, location);

  if (isInside(workspace, absolute) === false) {
    throw new Error(`Local source path escapes workspace: ${location}`);
  }

  try {
    return await fs.promises.readFile(absolute, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Local source file not found: ${location}`);
    }
    throw error;
  }
});

const root = new Singleton(async () => {
  for (const start of [process.cwd(), __dirname]) {
    const found: string | null = await findWorkspaceRoot(start);
    if (found !== null) return found;
  }
  throw new Error("Unable to find @ttsc/station workspace root");
});

async function findWorkspaceRoot(start: string): Promise<string | null> {
  let cwd: string = path.resolve(start);

  while (true) {
    const manifest: string = path.join(cwd, "package.json");
    if (fs.existsSync(manifest)) {
      const { name } = JSON.parse(await fs.promises.readFile(manifest, "utf8"));
      if (name === "@ttsc/station") return cwd;
    }

    const next: string = path.dirname(cwd);
    if (next === cwd) return null;
    cwd = next;
  }
}

function isInside(root: string, file: string): boolean {
  const relative: string = path.relative(root, file);
  return (
    relative.length === 0 ||
    (relative.startsWith("..") === false && path.isAbsolute(relative) === false)
  );
}

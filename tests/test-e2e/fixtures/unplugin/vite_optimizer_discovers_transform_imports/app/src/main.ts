import linked, { named } from "linked-pkg";
import "excluded-dep";
import "./view";

declare global {
  interface ImportMeta {
    glob(pattern: string): unknown;
  }
}

export const value = linked + named;
export const lazy = import.meta.glob("./lazy/*.ts");

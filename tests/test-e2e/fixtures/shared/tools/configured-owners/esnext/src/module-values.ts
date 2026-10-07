export enum ModuleLevel { Low = 2 }
export namespace RepeatedNamespace {
  export const value = 3;
  export function read(): string { return "repeated-" + value; }
}
export const enumRuntime = ModuleLevel[ModuleLevel.Low] + "-" + ModuleLevel.Low;
export const namespaceRuntime = RepeatedNamespace.read();

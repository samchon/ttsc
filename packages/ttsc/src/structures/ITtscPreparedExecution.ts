export interface ITtscPreparedExecution {
  emitDir: string;
  entryFile: string;
  moduleKind: "cjs" | "esm";
}

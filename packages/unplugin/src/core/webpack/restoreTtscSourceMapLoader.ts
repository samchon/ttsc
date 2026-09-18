// The module webpack and Rspack load as the loader: their loader runners take
// a module's `default` export, which a named export alone would not provide.
export { restoreTtscSourceMap as default } from "./restoreTtscSourceMap";

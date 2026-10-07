export { hello } from "./workspace/index"; export { derived } from "./default"; export const sentinel: string = "configured-esnext";
export { wrap, inside } from "./whole-project";
export { classification } from "./dependency-store/classification";
export { enumRuntime, namespaceRuntime } from "./module-values";
export { tag as strippedDependency } from "./strip-owned";
export { view as preservedView } from "./preserved-view";

import { Model } from "./barrel";
export function consume(model: Model): number { return model.read(); }

export type Brand<T> = T & { readonly __brand: unique symbol };
export namespace Brand { export interface Options { readonly tagged: boolean; } }

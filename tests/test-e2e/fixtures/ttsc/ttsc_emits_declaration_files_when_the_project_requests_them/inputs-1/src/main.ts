export interface Box<T> { value: T }
export const box = <T>(value: T): Box<T> => ({ value });

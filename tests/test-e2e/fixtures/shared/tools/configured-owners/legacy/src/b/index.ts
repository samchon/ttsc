let count = 0; function probe(...args: any[]): void { count = args.length; } class B { @probe method(): void {} } export const observed = "dep-b:" + count; export const instance = new B();

declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const vi: any;
declare const process: any;
declare const add: any;
describe("math", () => {
  test("adds", () => expect(add()).toBe(1));
// expect: vitest/no-identical-title error
  test("adds", () => expect(add()).toBe(2));
});

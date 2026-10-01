declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test, expect } from "@jest/globals";

// expect: jest/max-expects error
test("checks many values", () => {
  expect(1).toBe(1);
  expect(2).toBe(2);
  expect(3).toBe(3);
  expect(4).toBe(4);
  expect(5).toBe(5);
  expect(6).toBe(6);
});

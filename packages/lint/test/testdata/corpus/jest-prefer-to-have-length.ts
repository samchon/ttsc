declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test, expect } from "@jest/globals";

test("checks length", () => {
  const values = [1, 2, 3];
  // expect: jest/prefer-to-have-length error
  expect(values.length).toBe(3);
});

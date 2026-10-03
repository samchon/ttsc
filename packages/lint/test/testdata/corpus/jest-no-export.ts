declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test, expect } from "@jest/globals";

// expect: jest/no-export error
export const helper = 1;

test("uses helper", () => {
  expect(helper).toBe(1);
});

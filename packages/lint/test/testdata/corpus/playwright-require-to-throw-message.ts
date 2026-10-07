declare const test: any;
declare const expect: any;
declare const page: any;
import { test, expect } from "@playwright/test";

test("throws", async () => {
  // expect: playwright/require-to-throw-message error
  expect(() => {
    throw new Error("boom");
  }).toThrow();
});

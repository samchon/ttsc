// @ttsc-corpus-clean: jest/require-to-throw-message
import { test, expect } from "@jest/globals"; test("throws", () => { expect(() => { throw new Error("x"); }).toThrow("x"); });

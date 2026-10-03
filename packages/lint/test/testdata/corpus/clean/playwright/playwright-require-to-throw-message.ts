// @ttsc-corpus-clean: playwright/require-to-throw-message
import { test, expect } from "@playwright/test"; test("message", () => { expect(() => { throw new Error("boom"); }).toThrow("boom"); });

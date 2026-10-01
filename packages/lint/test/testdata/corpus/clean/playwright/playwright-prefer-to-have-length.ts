// @ttsc-corpus-clean: playwright/prefer-to-have-length
import { test, expect } from "@playwright/test"; test("length", () => { expect([1, 2]).toHaveLength(2); });

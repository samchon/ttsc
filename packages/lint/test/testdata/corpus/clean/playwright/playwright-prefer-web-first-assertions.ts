// @ttsc-corpus-clean: playwright/prefer-web-first-assertions
import { test, expect } from "@playwright/test"; test("visible", async ({ page }) => { await expect(page.getByRole("button")).toBeVisible(); });

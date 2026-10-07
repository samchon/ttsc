// @ttsc-corpus-clean: playwright/prefer-to-have-count
import { test, expect } from "@playwright/test"; test("count", async ({ page }) => { await expect(page.locator("li")).toHaveCount(2); });

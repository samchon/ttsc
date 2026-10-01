// @ttsc-corpus-clean: playwright/no-wait-for-selector
import { test } from "@playwright/test"; test("locator", ({ page }) => { page.getByRole("button"); });

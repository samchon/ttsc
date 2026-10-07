// @ttsc-corpus-clean: jest/no-duplicate-hooks
import { describe, beforeEach, afterEach } from "@jest/globals"; describe("suite", () => { beforeEach(() => {}); afterEach(() => {}); });

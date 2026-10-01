import assert from "node:assert/strict";
import { mapDiagnostic } from "../../../../packages/playground/src/compiler/mapDiagnostic";

/**
 * Verifies native diagnostic byte coordinates against literal editor coordinates.
 *
 * Native diagnostics carry UTF-8 byte offsets while the editor counts UTF-16 units
 * and line separators of every ECMAScript kind, so astral characters, combining
 * marks and separators must shift columns and lengths exactly as the literal table
 * states.
 *
 * 1. Map each authored native diagnostic over sources with ASCII, BMP, astral and
 *    combining prefixes, spans, offset-only and line-only inputs, and LF, CR,
 *    CRLF, LS and PS separators.
 * 2. Map a project-wide diagnostic that has no file and require its default
 *    position.
 * 3. Compare every result with the literal editor coordinates of its row and
 *    collect all mismatches before failing.
 *
 * @evidence contracts/testing.md#behavioral-verification All fifteen authored DTO rows call mapDiagnostic and compare complete normalized records.
 * @evidence contracts/testing.md#independent-expectations Literal one-based lines, UTF-16 columns and spans are authored independently of the mapper; the DTO supplies native UTF-8 byte offsets.
 * @evidence contracts/testing.md#distinguishing-cases ASCII, BMP, astral, combining, optional coordinates, every ECMAScript newline, and an unlocated project diagnostic preserve different boundaries.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry executes the owning source operations in this test process, without installing a consumer, building a native producer or fabricating process protocol replies.
 */
export function test_map_diagnostic_converts_native_bytes_to_editor_units(): void {
  const failures: unknown[] = [];
  for (const row of [
  {
    "name": "ascii-full",
    "source": "ax",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 1,
      "length": 1,
      "line": 1,
      "character": 2
    },
    "expected": {
      "line": 1,
      "column": 2,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "bmp-prefix-full",
    "source": "éx",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 2,
      "length": 1,
      "line": 1,
      "character": 3
    },
    "expected": {
      "line": 1,
      "column": 2,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "astral-prefix-full",
    "source": "😀x",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 4,
      "length": 1,
      "line": 1,
      "character": 5
    },
    "expected": {
      "line": 1,
      "column": 3,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "combining-prefix-full",
    "source": "éx",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 3,
      "length": 1,
      "line": 1,
      "character": 4
    },
    "expected": {
      "line": 1,
      "column": 3,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "astral-span",
    "source": "😀",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 0,
      "length": 4,
      "line": 1,
      "character": 1
    },
    "expected": {
      "line": 1,
      "column": 1,
      "length": 2,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "bmp-span",
    "source": "é",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 0,
      "length": 2,
      "line": 1,
      "character": 1
    },
    "expected": {
      "line": 1,
      "column": 1,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "bmp-offset-only",
    "source": "éx",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 2,
      "length": 1
    },
    "expected": {
      "line": 1,
      "column": 2,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "astral-line-only",
    "source": "😀x",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 4,
      "length": 1,
      "line": 1
    },
    "expected": {
      "line": 1,
      "column": 3,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "astral-character-only",
    "source": "😀x",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 4,
      "length": 1,
      "character": 5
    },
    "expected": {
      "line": 1,
      "column": 3,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "LF-full",
    "source": "é\nx",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 3,
      "length": 1,
      "line": 2,
      "character": 1
    },
    "expected": {
      "line": 2,
      "column": 1,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "CR-offset-only",
    "source": "é\rx",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 3,
      "length": 1
    },
    "expected": {
      "line": 2,
      "column": 1,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "CRLF-full",
    "source": "é\r\nx",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 4,
      "length": 1,
      "line": 2,
      "character": 1
    },
    "expected": {
      "line": 2,
      "column": 1,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "LS-offset-only",
    "source": "é x",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 5,
      "length": 1
    },
    "expected": {
      "line": 2,
      "column": 1,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "PS-offset-only",
    "source": "é x",
    "input": {
      "file": "/project/authored-source.ts",
      "category": "error",
      "code": 9001,
      "messageText": "authored",
      "start": 5,
      "length": 1
    },
    "expected": {
      "line": 2,
      "column": 1,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  },
  {
    "name": "project-wide-default",
    "source": "abc",
    "input": {
      "file": null,
      "category": "error",
      "code": 9001,
      "messageText": "authored"
    },
    "expected": {
      "line": 1,
      "column": 1,
      "length": 1,
      "severity": "error",
      "message": "authored",
      "code": "TS9001"
    }
  }
]) {
    try { assert.deepEqual(mapDiagnostic(row.input as Parameters<typeof mapDiagnostic>[0], row.source), row.expected, row.name); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Diagnostic byte-coordinate matrix failed");
}

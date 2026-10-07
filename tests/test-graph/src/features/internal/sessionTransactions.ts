import { DUMP_SCHEMA_VERSION } from "../../../../../packages/graph/src/model/loadGraph";
import type { ITtscGraphSnapshot } from "../../../../../packages/graph/src/structures/ITtscGraphSnapshot";

// Typed state inputs, not native output. The literal hash witnesses cover the
// original Go-map field order (sorted map keys) and ordered generation struct.
// No product serializer, digest helper or generated validator creates them.
const fixtures = {
  initial: {
    protocolVersion: 1,
    schemaVersion: 8,
    project: "/fixture",
    tsconfig: "tsconfig.json",
    producer: {
      tool: "native-session-fake",
      typescript: "test",
      version: "test",
    },
    capabilities: [],
    universe: {
      configs: [],
      roots: [],
    },
    sequence: 1,
    generation:
      "37769d2c8553d50c23815d28b5e2dc981132d5a2966eab0212eed9a6a58a5db0",
    upserts: [
      {
        digest:
          "4404cfc49615d8e07e94435d333c9714b6d996df35668d06c3dacaaaa1bc3617",
        shard: {
          diagnostics: [],
          edges: [],
          key: "0:metadata:test",
          nodes: [],
        },
      },
    ],
    deletes: [],
    manifest: [
      {
        digest:
          "4404cfc49615d8e07e94435d333c9714b6d996df35668d06c3dacaaaa1bc3617",
        key: "0:metadata:test",
      },
    ],
  },
  unicode: {
    protocolVersion: 1,
    schemaVersion: 8,
    project: "/fixture",
    tsconfig: "tsconfig.json",
    producer: {
      tool: "native-session-fake",
      typescript: "test",
      version: "test",
    },
    capabilities: [],
    universe: {
      configs: [],
      roots: [],
    },
    sequence: 1,
    generation:
      "62feadab8da4d205f47941448326d01a4ba9ef333df7a281ad37742be946e301",
    upserts: [
      {
        digest:
          "adb4379388c65e6c9863010ebcbe7f6914a16a36c7a48e270b57f8b5e128435f",
        shard: {
          diagnostics: [],
          edges: [],
          key: "0:metadata:\ue000",
          nodes: [],
        },
      },
      {
        digest:
          "35ab293e9c2ee46be8f9ad6288ee0ebcbc859efe1c9cf344aaaebd8f4f5073ac",
        shard: {
          diagnostics: [],
          edges: [],
          key: "0:metadata:\ud800\udc00",
          nodes: [],
        },
      },
    ],
    deletes: [],
    manifest: [
      {
        digest:
          "adb4379388c65e6c9863010ebcbe7f6914a16a36c7a48e270b57f8b5e128435f",
        key: "0:metadata:\ue000",
      },
      {
        digest:
          "35ab293e9c2ee46be8f9ad6288ee0ebcbc859efe1c9cf344aaaebd8f4f5073ac",
        key: "0:metadata:\ud800\udc00",
      },
    ],
  },
  duplicateConfig: {
    protocolVersion: 1,
    schemaVersion: 8,
    project: "/fixture",
    tsconfig: "tsconfig.json",
    producer: {
      tool: "native-session-fake",
      typescript: "test",
      version: "test",
    },
    capabilities: [],
    universe: {
      configs: [
        {
          digest: "config-a",
          file: "tsconfig.json",
        },
        {
          digest: "config-a",
          file: "tsconfig.json",
        },
      ],
      roots: [],
    },
    sequence: 1,
    generation:
      "3081bd7a278c3a2a0cbf5c360d4e9d58fb0086f18d25d2e376c9be400d87b6fb",
    upserts: [
      {
        digest:
          "4404cfc49615d8e07e94435d333c9714b6d996df35668d06c3dacaaaa1bc3617",
        shard: {
          diagnostics: [],
          edges: [],
          key: "0:metadata:test",
          nodes: [],
        },
      },
      {
        digest:
          "c94f508cd34f55ad30e2e9f66d18f026a0cbfdf4afbc8c306d88e65354265d07",
        shard: {
          config: {
            digest: "config-a",
            file: "tsconfig.json",
          },
          diagnostics: [],
          edges: [],
          key: "3:config:a",
          nodes: [],
        },
      },
      {
        digest:
          "3e50cf70d02ec7d08b40b82e50d5c365f760e3b4b4c78b37f4b9fc514fe65ecf",
        shard: {
          config: {
            digest: "config-b",
            file: "hidden.json",
          },
          diagnostics: [],
          edges: [],
          key: "3:config:b",
          nodes: [],
        },
      },
    ],
    deletes: [],
    manifest: [
      {
        digest:
          "4404cfc49615d8e07e94435d333c9714b6d996df35668d06c3dacaaaa1bc3617",
        key: "0:metadata:test",
      },
      {
        digest:
          "c94f508cd34f55ad30e2e9f66d18f026a0cbfdf4afbc8c306d88e65354265d07",
        key: "3:config:a",
      },
      {
        digest:
          "3e50cf70d02ec7d08b40b82e50d5c365f760e3b4b4c78b37f4b9fc514fe65ecf",
        key: "3:config:b",
      },
    ],
  },
  duplicateManifest: {
    protocolVersion: 1,
    schemaVersion: 8,
    project: "/fixture",
    tsconfig: "tsconfig.json",
    producer: {
      tool: "native-session-fake",
      typescript: "test",
      version: "test",
    },
    capabilities: [],
    universe: {
      configs: [],
      roots: [],
    },
    sequence: 1,
    generation:
      "d54a97129af9e04b279aa32ac0ff14c44fb6ac1799cfeaebc5ba3e63d01dabab",
    upserts: [
      {
        digest:
          "4404cfc49615d8e07e94435d333c9714b6d996df35668d06c3dacaaaa1bc3617",
        shard: {
          diagnostics: [],
          edges: [],
          key: "0:metadata:test",
          nodes: [],
        },
      },
      {
        digest:
          "3be4df4650458056689cfb3279244cd33f5614cbeb66e1ef85d73c82a4556696",
        shard: {
          diagnostics: [],
          edges: [],
          key: "0:metadata:test-2",
          nodes: [],
        },
      },
    ],
    deletes: [],
    manifest: [
      {
        digest:
          "4404cfc49615d8e07e94435d333c9714b6d996df35668d06c3dacaaaa1bc3617",
        key: "0:metadata:test",
      },
      {
        digest:
          "4404cfc49615d8e07e94435d333c9714b6d996df35668d06c3dacaaaa1bc3617",
        key: "0:metadata:test",
      },
    ],
  },
} as const;

/** Fresh typed transaction; callers may mutate only their own input. */
export function sessionTransaction(
  kind: keyof typeof fixtures = "initial",
): ITtscGraphSnapshot.ITransaction {
  const transaction = JSON.parse(
    JSON.stringify(fixtures[kind]),
  ) as ITtscGraphSnapshot.ITransaction;
  transaction.schemaVersion = DUMP_SCHEMA_VERSION;
  return transaction;
}

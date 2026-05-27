"use client";

import Editor, { type Monaco } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { DEFAULT_PLAYGROUND_COMPILER_OPTIONS } from "../compiler/DEFAULT_PLAYGROUND_COMPILER_OPTIONS";
import type { ISourceEditorProps } from "../structures/ISourceEditorProps";

export function SourceEditor({
  value,
  onChange,
  extraLibs,
  path = "file:///src/playground.ts",
}: ISourceEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);
  const libDisposables = useRef<{ dispose(): void }[]>([]);
  const allExtraLibs = useMemo(
    () => (extraLibs ? Object.entries(extraLibs) : []),
    [extraLibs],
  );

  const installExtraLibs = useCallback(
    (monaco: Monaco) => {
      for (const disposable of libDisposables.current) disposable.dispose();
      libDisposables.current = [];
      const tsd = monaco.languages.typescript.typescriptDefaults;
      for (const [file, content] of allExtraLibs) {
        libDisposables.current.push(tsd.addExtraLib(content, file));
      }
    },
    [allExtraLibs],
  );

  useEffect(() => {
    if (monacoRef.current) installExtraLibs(monacoRef.current);
    return () => {
      for (const disposable of libDisposables.current) disposable.dispose();
      libDisposables.current = [];
    };
  }, [installExtraLibs]);

  const handleMount = (_editor: unknown, monaco: Monaco) => {
    monacoRef.current = monaco;
    const tsd = monaco.languages.typescript.typescriptDefaults;
    tsd.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution:
        monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: DEFAULT_PLAYGROUND_COMPILER_OPTIONS.esModuleInterop,
      strict: DEFAULT_PLAYGROUND_COMPILER_OPTIONS.strict,
      experimentalDecorators:
        DEFAULT_PLAYGROUND_COMPILER_OPTIONS.experimentalDecorators,
      allowNonTsExtensions: true,
      // External .d.ts packs (typia, etc.) routinely reference transitive types
      // Monaco cannot reach (deep paths in JSDoc, optional peers). skipLibCheck
      // keeps the editor lean by not type-checking the lib pack.
      skipLibCheck: true,
    });
    tsd.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        // 2307: Cannot find module — JSDoc-only stubbed deps still occasionally
        //       leak through Monaco's module resolution.
        2307,
      ],
    });
    installExtraLibs(monaco);
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      path={path}
      options={{
        tabSize: 2,
        minimap: { enabled: false },
        padding: { top: 12, bottom: 12 },
        fontSize: 13,
        fontFamily:
          "ui-monospace, SFMono-Regular, 'JetBrains Mono', 'Fira Code', Consolas, monospace",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        wordWrap: "on",
      }}
    />
  );
}

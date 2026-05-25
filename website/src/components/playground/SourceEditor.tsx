"use client";

import Editor, { type Monaco } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { COMPILER_OPTIONS } from "../../compiler/COMPILER_OPTIONS";
import typiaTypes from "../../compiler/typia-types.json";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  extraLibs?: Record<string, string>;
}

const EXTRA_LIBS = Object.entries(typiaTypes as Record<string, string>);

export default function SourceEditor({
  value,
  onChange,
  extraLibs = {},
}: SourceEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);
  const libDisposables = useRef<{ dispose(): void }[]>([]);
  const allExtraLibs = useMemo(
    () => [...EXTRA_LIBS, ...Object.entries(extraLibs)],
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
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: COMPILER_OPTIONS.esModuleInterop,
      strict: COMPILER_OPTIONS.strict,
      experimentalDecorators: COMPILER_OPTIONS.experimentalDecorators,
      allowNonTsExtensions: true,
      // typia and its d.ts neighbours pull in transitive types Monaco can't
      // always reach (e.g. @typia/mcp deep paths inside JSDoc examples).
      // skipLibCheck keeps the editor lean by not type-checking the d.ts pack.
      skipLibCheck: true,
    });
    tsd.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        // 2307: Cannot find module — typia's JSDoc-only stubbed deps still
        //       sometimes leak through Monaco's module resolution.
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
      path="file:///src/playground.ts"
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

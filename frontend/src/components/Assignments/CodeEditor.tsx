import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import { useEffect, useState } from "react";

window.MonacoEnvironment = {
  getWorker: (_workerId, label) =>
    label === "javascript" || label === "typescript"
      ? new tsWorker()
      : new editorWorker(),
};

loader.config({ monaco });

type CodeEditorProps = {
  language: "python" | "javascript";
  value: string;
  onChange: (value: string) => void;
};

function getEditorTheme() {
  return document.body.dataset.theme === "dark" ? "vs-dark" : "light";
}

export default function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  const [theme, setTheme] = useState(getEditorTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getEditorTheme()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sl-ass-code-editor">
      <Editor
        height="360px"
        language={language}
        theme={theme}
        value={value}
        onChange={(nextValue) => onChange((nextValue ?? "").slice(0, 50000))}
        options={{
          ariaLabel: "Исходный код",
          automaticLayout: true,
          fontSize: 14,
          lineNumbers: "on",
          minimap: { enabled: false },
          quickSuggestions: true,
          scrollBeyondLastLine: false,
          suggestOnTriggerCharacters: true,
          tabSize: 4,
          wordWrap: "on",
        }}
      />
    </div>
  );
}

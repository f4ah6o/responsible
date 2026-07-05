import { useCallback, useRef } from "react";

export type ModelLoaderProps = {
  onLoadFile: (file: File) => void;
  error?: string | undefined;
};

export function ModelLoader({ onLoadFile, error }: ModelLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      // Reset so selecting the same file again re-triggers change.
      event.currentTarget.value = "";
      if (file) onLoadFile(file);
    },
    [onLoadFile],
  );

  return (
    <section className="model-loader" aria-label="プロセスモデルの読み込み">
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleChange}
        hidden
      />
      <button type="button" className="secondary-action" onClick={() => inputRef.current?.click()}>
        JSON を読み込む
      </button>
      {error && (
        <span className="model-loader-error" role="alert">
          {error}
        </span>
      )}
    </section>
  );
}

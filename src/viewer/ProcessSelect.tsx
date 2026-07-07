import type { SampleProcess } from "../sample.js";

export type ProcessSelectErrorEntry = Readonly<{ id: string; title: string }>;

export type ProcessSelectProps = {
  processes: readonly SampleProcess[];
  value: string;
  onChange: (id: string) => void;
  errors?: readonly ProcessSelectErrorEntry[];
};

export function ProcessSelect({ processes, value, onChange, errors }: ProcessSelectProps) {
  return (
    <label className="process-picker">
      <span>プロセス</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {processes.map((process) => (
          <option key={process.id} value={process.id}>
            {process.title}
          </option>
        ))}
        {errors?.map((entry) => (
          <option key={entry.id} value={entry.id} disabled>
            {entry.title}（読み込みエラー）
          </option>
        ))}
      </select>
    </label>
  );
}

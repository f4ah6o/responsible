import type { SampleProcess } from "../sample.js";

export type ProcessSelectProps = {
  processes: readonly SampleProcess[];
  value: string;
  onChange: (id: string) => void;
};

export function ProcessSelect({ processes, value, onChange }: ProcessSelectProps) {
  return (
    <label className="process-picker">
      <span>プロセス</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {processes.map((process) => (
          <option key={process.id} value={process.id}>
            {process.title}
          </option>
        ))}
      </select>
    </label>
  );
}

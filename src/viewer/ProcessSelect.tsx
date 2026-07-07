import type { SampleProcess } from "../sample.js";
import { useI18n } from "./i18n";

export type ProcessSelectProps = {
  processes: readonly SampleProcess[];
  value: string;
  onChange: (id: string) => void;
};

export function ProcessSelect({ processes, value, onChange }: ProcessSelectProps) {
  const { t } = useI18n();
  return (
    <label className="process-picker">
      <span>{t("processLabel")}</span>
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

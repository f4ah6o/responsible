import type { SampleProcess } from "../sample.js";
import { useI18n } from "./i18n";

export type ProcessSelectErrorEntry = Readonly<{ id: string; title: string }>;

export type ProcessSelectProps = {
  processes: readonly SampleProcess[];
  value: string;
  onChange: (id: string) => void;
  errors?: readonly ProcessSelectErrorEntry[];
};

export function ProcessSelect({ processes, value, onChange, errors }: ProcessSelectProps) {
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
        {errors?.map((entry) => (
          <option key={entry.id} value={entry.id} disabled>
            {t("loadErrorOption", { title: entry.title })}
          </option>
        ))}
      </select>
    </label>
  );
}

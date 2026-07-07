import { HIERARCHICAL_BOUNDARY_ORDER, canZoomIn, canZoomOut } from "../index.js";
import { useI18n, type MessageKey } from "./i18n";

export type BoundaryZoomControlProps = {
  level: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

const BOUNDARY_LABEL_KEYS: Record<string, MessageKey> = {
  company: "boundaryCompany",
  department: "boundaryDepartment",
  section: "boundarySection",
  team: "boundaryTeam",
  person: "boundaryPerson",
};

export function BoundaryZoomControl({ level, onZoomIn, onZoomOut }: BoundaryZoomControlProps) {
  const { t } = useI18n();
  const key = HIERARCHICAL_BOUNDARY_ORDER[level] ?? "—";
  const labelKey = BOUNDARY_LABEL_KEYS[key];
  const label = labelKey ? t(labelKey) : key;
  const ordinal = level + 1;
  const total = HIERARCHICAL_BOUNDARY_ORDER.length;
  const canIn = canZoomIn(level);
  const canOut = canZoomOut(level);

  return (
    <section className="zoom-bar" aria-label={t("boundaryZoomAriaLabel")}>
      <button className="secondary-action" onClick={onZoomOut} disabled={!canOut}>
        {t("zoomCoarser")}
      </button>
      <div className="zoom-scope">
        <span>{t("boundaryZoomLabel")}</span>
        <strong>{label}</strong>
        <small>{t("boundaryZoomLevel", { ordinal, total })}</small>
      </div>
      <button className="primary-action" onClick={onZoomIn} disabled={!canIn}>
        {t("zoomFiner")}
      </button>
    </section>
  );
}

import { createContext, useContext } from "react";

export type Locale = "ja" | "en";

const STORAGE_KEY = "responsible.locale";

const ja = {
  loadJson: "JSON を読み込む",
  modelLoaderAriaLabel: "プロセスモデルの読み込み",
  importError: "{fileName} を読み込めませんでした — {issues}",
  importErrorMore: " ほか{count}件",
  importedTitleSuffix: "{title}（読み込み）",
  processLabel: "プロセス",
  zoomCoarser: "粗く見る",
  zoomFiner: "詳しく見る",
  boundaryZoomAriaLabel: "責任境界ズーム",
  boundaryZoomLabel: "境界ズーム",
  boundaryZoomLevel: "レベル {ordinal}/{total}",
  boundaryCompany: "会社",
  boundaryDepartment: "部門",
  boundarySection: "課・セクション",
  boundaryTeam: "チーム",
  boundaryPerson: "担当者",
  scopeBreadcrumbAriaLabel: "現在の表示スコープ",
  scopeDrillDownAriaLabel: "下位スコープへ移動",
  scopeSelectPlaceholder: "分解先",
  scopeUnavailable: "このスコープは表示できません",
  effectUnavailable: "Effect を表示できません（INV-3 違反）",
  effectIssuesMore: " ほか{count}件",
  effectLegend: "Effect（境界を越えて観測可能な作用。破線は directed の配送先）",
  fatalErrorTitle: "表示中にエラーが発生しました",
  reload: "再読み込み",
  kindAtomic: "単体",
  kindComposite: "合成",
  effectsAriaLabel: "観測可能な Effect",
  compositeSubtitle: "{count} 件の Activity を合成",
  membersAriaLabel: "合成された Activity の内訳",
  hideMembers: "▾ 内訳を隠す",
  showMembers: "▸ 内訳を表示（{count}）",
  localeToggleAriaLabel: "表示言語",
} as const;

export type MessageKey = keyof typeof ja;

// `en` must declare exactly the keys of `ja` — adding a string to one
// dictionary without the other is a type error, not a silent runtime gap.
const en: Record<MessageKey, string> = {
  loadJson: "Load JSON",
  modelLoaderAriaLabel: "Load process model",
  importError: "Could not load {fileName} — {issues}",
  importErrorMore: " and {count} more",
  importedTitleSuffix: "{title} (imported)",
  processLabel: "Process",
  zoomCoarser: "Coarser view",
  zoomFiner: "Finer view",
  boundaryZoomAriaLabel: "Responsibility boundary zoom",
  boundaryZoomLabel: "Boundary zoom",
  boundaryZoomLevel: "Level {ordinal}/{total}",
  boundaryCompany: "Company",
  boundaryDepartment: "Department",
  boundarySection: "Section",
  boundaryTeam: "Team",
  boundaryPerson: "Person",
  scopeBreadcrumbAriaLabel: "Current display scope",
  scopeDrillDownAriaLabel: "Move to a lower scope",
  scopeSelectPlaceholder: "Decompose into",
  scopeUnavailable: "This scope cannot be displayed",
  effectUnavailable: "Effects cannot be displayed (INV-3 violation)",
  effectIssuesMore: " and {count} more",
  effectLegend:
    "Effect (an observable, boundary-crossing action. Dashed lines are directed delivery targets)",
  fatalErrorTitle: "An error occurred while rendering",
  reload: "Reload",
  kindAtomic: "Atomic",
  kindComposite: "Composite",
  effectsAriaLabel: "Observable effects",
  compositeSubtitle: "Composed of {count} Activities",
  membersAriaLabel: "Breakdown of composed Activities",
  hideMembers: "▾ Hide breakdown",
  showMembers: "▸ Show breakdown ({count})",
  localeToggleAriaLabel: "Display language",
};

const messages = { ja, en } satisfies Record<Locale, Record<MessageKey, string>>;

type Params = Readonly<Record<string, string | number>>;

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return format(messages[locale][key], params);
}

export function messageKeys(): readonly MessageKey[] {
  return Object.keys(ja) as MessageKey[];
}

export function detectInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "ja" || stored === "en") return stored;
    } catch {
      // localStorage unavailable (e.g. private mode) — fall through to navigator detection.
    }
  }
  const language = typeof navigator === "undefined" ? "" : navigator.language;
  return language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage unavailable — selection just won't survive a reload.
  }
}

export type I18n = Readonly<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Params) => string;
}>;

export const LocaleContext = createContext<I18n>({
  locale: "en",
  setLocale: () => {},
  t: (key) => messages.en[key],
});

export function useI18n(): I18n {
  return useContext(LocaleContext);
}

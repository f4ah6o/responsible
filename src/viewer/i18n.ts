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
  deleteImportedModel: "このモデルを削除",
  loadErrorOption: "{title}（読み込みエラー）",
  deleteImportErrorAriaLabel: "{title} を削除",
  copyShareLink: "共有リンクをコピー",
  shareCopied: "コピーしました",
  shareLoadingError: "共有リンクのモデルを読み込み中です。少し待ってからもう一度お試しください。",
  shareGenerateError: "共有リンクを生成できませんでした — {message}",
  shareTooLargeError:
    "モデルが大きすぎて URL 共有できません。JSON ファイルを直接共有してください。",
  shareClipboardError: "クリップボードにコピーできませんでした — {message}",
  sharedModelUnavailable: "共有リンクを読み込めません",
  sharedModelLoadError: "共有リンクのモデルを読み込めませんでした — {message}",
  sharedModelTitle: "共有モデル",
  exportAriaLabel: "図のエクスポート",
  exporting: "出力中…",
  authoringOpen: "カードで作成",
  authoringClose: "ビューアーに戻る",
  authoringTitleLabel: "プロセス名",
  authoringTitlePlaceholder: "例: 申請承認",
  authoredTitleFallback: "カード作成プロセス",
  paletteHeading: "カードパレット",
  addActivityCard: "業務カードを追加",
  addDecisionCard: "判断カードを追加",
  paletteHint: "カードをドラッグして並べ、カードの右端から次のカードへドラッグして接続します。",
  laneHintsHeading: "担当カード",
  addLaneHint: "担当カードを追加",
  applyLaneHint: "選択中のカードに適用",
  laneHintLabelPlaceholder: "表示名",
  removeLaneHint: "この担当カードを削除",
  cardKindActivity: "業務",
  cardKindDecision: "判断",
  cardUntitled: "（無題）",
  detailHeading: "カードの詳細",
  detailEmpty: "カードまたは接続を選択すると、ここで編集できます。",
  fieldTitle: "業務名",
  fieldInput: "入力",
  fieldOutput: "出力",
  fieldStatus: "状態",
  statusNone: "（未設定）",
  responsibilityHeading: "担当（責任境界）",
  requiresHeading: "前提条件（requires）",
  ensuresHeading: "完了条件（ensures）",
  addCondition: "条件を追加",
  outcomesHeading: "分岐結果",
  effectsHeading: "作用（effects）",
  addEffect: "作用を追加",
  effectSchemaPlaceholder: "内容（スキーマ名）",
  effectTargetHeading: "作用先の担当",
  removeEntryAriaLabel: "この項目を削除",
  deleteCard: "このカードを削除",
  connectionHeading: "接続の詳細",
  connectionOutcomeLabel: "分岐結果（判断カードの出力）",
  connectionOutcomeNone: "（指定なし）",
  connectionMappingLabel: "受け渡し（mapping）",
  connectionContractLabel: "契約（contract）",
  deleteConnection: "この接続を削除",
  previewHeading: "生成された responsible.v1 JSON",
  validationOk: "モデルは有効です",
  validationIssues: "検証エラー {count} 件",
  openInViewer: "ビューアーで開く",
  exportDeckJson: "JSON をエクスポート",
  loadSampleDeck: "サンプルを読み込む",
  clearDeck: "すべてクリア",
  confirmReplaceDeck: "編集中のカードをサンプルで置き換えます。よろしいですか？",
  confirmClearDeck: "すべてのカードを削除します。よろしいですか？",
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
  deleteImportedModel: "Delete this model",
  loadErrorOption: "{title} (load error)",
  deleteImportErrorAriaLabel: "Delete {title}",
  copyShareLink: "Copy share link",
  shareCopied: "Copied",
  shareLoadingError: "The shared model is still loading. Please wait a moment and try again.",
  shareGenerateError: "Could not generate a share link — {message}",
  shareTooLargeError:
    "The model is too large to share via URL. Please share the JSON file directly.",
  shareClipboardError: "Could not copy to clipboard — {message}",
  sharedModelUnavailable: "Cannot load the shared link",
  sharedModelLoadError: "Could not load the shared model — {message}",
  sharedModelTitle: "Shared model",
  exportAriaLabel: "Export diagram",
  exporting: "Exporting…",
  authoringOpen: "Create with cards",
  authoringClose: "Back to viewer",
  authoringTitleLabel: "Process name",
  authoringTitlePlaceholder: "e.g. Application approval",
  authoredTitleFallback: "Card-authored process",
  paletteHeading: "Card palette",
  addActivityCard: "Add Activity card",
  addDecisionCard: "Add Decision card",
  paletteHint:
    "Drag cards to arrange them; drag from a card's right edge to the next card to connect.",
  laneHintsHeading: "Responsibility cards",
  addLaneHint: "Add Responsibility card",
  applyLaneHint: "Apply to selected card",
  laneHintLabelPlaceholder: "Display name",
  removeLaneHint: "Remove this Responsibility card",
  cardKindActivity: "Activity",
  cardKindDecision: "Decision",
  cardUntitled: "(untitled)",
  detailHeading: "Card details",
  detailEmpty: "Select a card or connection to edit it here.",
  fieldTitle: "Title",
  fieldInput: "Input",
  fieldOutput: "Output",
  fieldStatus: "Status",
  statusNone: "(not set)",
  responsibilityHeading: "Responsibility",
  requiresHeading: "Preconditions (requires)",
  ensuresHeading: "Postconditions (ensures)",
  addCondition: "Add condition",
  outcomesHeading: "Outcomes",
  effectsHeading: "Effects",
  addEffect: "Add effect",
  effectSchemaPlaceholder: "Payload (schema name)",
  effectTargetHeading: "Delivery target",
  removeEntryAriaLabel: "Remove this entry",
  deleteCard: "Delete this card",
  connectionHeading: "Connection details",
  connectionOutcomeLabel: "Outcome (Decision card output)",
  connectionOutcomeNone: "(none)",
  connectionMappingLabel: "Mapping",
  connectionContractLabel: "Contract",
  deleteConnection: "Delete this connection",
  previewHeading: "Generated responsible.v1 JSON",
  validationOk: "Model is valid",
  validationIssues: "{count} validation issues",
  openInViewer: "Open in viewer",
  exportDeckJson: "Export JSON",
  loadSampleDeck: "Load sample",
  clearDeck: "Clear all",
  confirmReplaceDeck: "Replace the cards you are editing with the sample?",
  confirmClearDeck: "Delete all cards?",
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

import { createContext, useContext } from "react";

export type MeasuredSize = { width: number; height: number };

export type SizeReporter = (id: string, size: MeasuredSize) => void;

export const SizeReportContext = createContext<SizeReporter>(() => {});

export function useSizeReporter(): SizeReporter {
  return useContext(SizeReportContext);
}

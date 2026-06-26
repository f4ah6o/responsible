import { createContext, useContext } from "react";

export type HeightReporter = (id: string, height: number) => void;

export const HeightReportContext = createContext<HeightReporter>(() => {});

export function useHeightReporter(): HeightReporter {
  return useContext(HeightReportContext);
}

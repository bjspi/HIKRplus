import type { ExtensionSettings, PageContext } from "../shared/types";

export interface FeatureContext {
  page: PageContext;
  settings: ExtensionSettings;
  root: HTMLElement;
  log(message: string): void;
}

export interface HikrFeature {
  id: keyof ExtensionSettings["features"];
  title: string;
  defaultEnabled: boolean;
  matchesPage(context: PageContext): boolean;
  run(context: FeatureContext): Promise<void> | void;
  cleanup?(): Promise<void> | void;
}

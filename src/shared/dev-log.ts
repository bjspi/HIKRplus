let enabled = false;

export function setDevLogging(value: boolean): void {
  enabled = value;
}

export function isDevLogging(): boolean {
  return enabled;
}

export function devLog(scope: string, ...args: unknown[]): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(`[HIKR:${scope}]`, ...args);
}

export function devWarn(scope: string, ...args: unknown[]): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.warn(`[HIKR:${scope}]`, ...args);
}

export function devGroup(scope: string, label: string): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[HIKR:${scope}] ${label}`);
}

export function devGroupEnd(): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.groupEnd();
}

import AsyncStorage from '@react-native-async-storage/async-storage';

export type CrashBreadcrumb = {
  at: string;
  flow: string;
  step: string;
  meta?: string;
};

const BREADCRUMB_KEY = 'debug_crash_breadcrumbs_v1';
const MAX_BREADCRUMBS = 80;

function safeMeta(meta: unknown): string | undefined {
  if (meta === undefined || meta === null) return undefined;
  try {
    return JSON.stringify(meta);
  } catch {
    try {
      return String(meta);
    } catch {
      return 'unserializable_meta';
    }
  }
}

export async function addBreadcrumb(flow: string, step: string, meta?: unknown): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BREADCRUMB_KEY);
    const list: CrashBreadcrumb[] = raw ? JSON.parse(raw) : [];
    list.push({
      at: new Date().toISOString(),
      flow,
      step,
      meta: safeMeta(meta),
    });
    const trimmed = list.slice(-MAX_BREADCRUMBS);
    await AsyncStorage.setItem(BREADCRUMB_KEY, JSON.stringify(trimmed));
  } catch {
    // Never throw from breadcrumb logger.
  }
}

export async function getBreadcrumbs(): Promise<CrashBreadcrumb[]> {
  try {
    const raw = await AsyncStorage.getItem(BREADCRUMB_KEY);
    return raw ? (JSON.parse(raw) as CrashBreadcrumb[]) : [];
  } catch {
    return [];
  }
}

export async function clearBreadcrumbs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BREADCRUMB_KEY);
  } catch {
    // noop
  }
}


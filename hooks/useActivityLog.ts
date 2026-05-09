import { useCallback } from 'react';
import api from '../utils/api';

/**
 * Fire-and-forget activity logger for frontend events.
 *
 * Two channels:
 *   • logEvent  → /activity-logs/event  (info-level, normal user actions)
 *   • logError  → /activity-logs/error  (technical errors only — NOT validation)
 *
 * The axios response interceptor in utils/api.ts already auto-forwards
 * 5xx and network errors. Use logError for things axios can't catch:
 * caught JS exceptions, render failures, unexpected null states, etc.
 *
 * Usage:
 *   const { logEvent, logError } = useActivityLog();
 *   useFocusEffect(useCallback(() => { logEvent('open_maintenance', 'maintenance'); }, []));
 *
 *   try { ... }
 *   catch (e) { logError('parse_bill_failed', 'maintenance', { message: String(e) }); }
 */
export function useActivityLog() {
  const logEvent = useCallback(
    (action: string, module: string, detail: Record<string, any> = {}) => {
      api.post('/activity-logs/event', { action, module, detail }).catch(() => {});
    },
    []
  );

  const logError = useCallback(
    (action: string, module: string, detail: Record<string, any> = {}) => {
      api.post('/activity-logs/error', { action, module, detail }).catch(() => {});
    },
    []
  );

  return { logEvent, logError };
}

/**
 * Side-effect import: patches React Native Alert.alert at app startup (before first render).
 * Import this once at the root layout. Explicit imports should use `utils/alert`.
 */
import { initAlertPatch } from './alertPatch';

initAlertPatch();

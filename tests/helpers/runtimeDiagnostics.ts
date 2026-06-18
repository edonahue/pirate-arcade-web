/**
 * @deprecated Use tests/helpers/diagnostics.ts instead.
 * This file re-exports the canonical DiagnosticCollector for backward
 * compatibility and will be removed in a future cleanup pass.
 */
export { createDiagnosticCollector } from "./diagnostics";
export type {
  DiagnosticCollector,
  RequestObservation,
  RuntimeSnapshot,
} from "./diagnostics";

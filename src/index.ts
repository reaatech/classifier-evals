/**
 * classifier-evals — Offline classifier evaluation harness
 */

// Types
export * from './types/index.js';

// Dataset
export * from './dataset/loader.js';
export * from './dataset/validator.js';
export * from './dataset/splitter.js';
export * from './dataset/label-manager.js';

// Metrics
export * from './metrics/confusion-matrix.js';
export * from './metrics/classification-metrics.js';
export * from './metrics/comparison.js';
export * from './metrics/visualization-data.js';

// Judge
export * from './judge/index.js';
export * from './judge/cost-tracker.js';
export * from './judge/prompt-templates.js';
export * from './judge/judge-engine.js';

// Gates
export * from './gates/gate-engine.js';
export * from './gates/threshold-gates.js';
export * from './gates/baseline-comparison.js';
export * from './gates/distribution-gates.js';
export * from './gates/ci-integration.js';

// Exporters
export * from './exporters/index.js';

// Observability
export * from './observability/index.js';

// Utilities
export * from './utils/index.js';

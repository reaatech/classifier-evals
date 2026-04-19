/**
 * check_gates MCP tool implementation
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GateEngine } from '../../gates/gate-engine.js';
import { logger } from '../../observability/logger.js';
import type { EvalRun, RegressionGate } from '../../types/index.js';
import {
  loadEvalRunFromFile,
  loadRegressionGatesFromFile,
  normalizeRegressionGate,
} from '../../utils/eval-run.js';

export async function checkGatesTool(args: Record<string, unknown>): Promise<CallToolResult> {
  const evalResults =
    typeof args.eval_results === 'string'
      ? loadEvalRunFromFile(args.eval_results)
      : (args.eval_results as EvalRun);
  const gateConfig =
    typeof args.gate_config === 'string'
      ? loadRegressionGatesFromFile(args.gate_config)
      : Array.isArray(args.gate_config)
        ? (args.gate_config as Record<string, unknown>[]).map((gate) =>
            normalizeRegressionGate(gate)
          )
        : undefined;

  if (gateConfig === undefined) {
    return {
      content: [{ type: 'text', text: 'Error: eval_results and gate_config are required' }],
      isError: true,
    };
  }

  const baselineResults =
    typeof args.baseline_results === 'string'
      ? loadEvalRunFromFile(args.baseline_results)
      : undefined;
  const gates: RegressionGate[] = gateConfig.map((gate) =>
    gate.type === 'baseline-comparison' ||
    (gate.baseline_path !== undefined && gate.baseline_path !== '')
      ? {
          ...gate,
          baseline_path:
            gate.baseline_path ??
            (typeof args.baseline_results === 'string'
              ? args.baseline_results
              : undefined),
        }
      : gate
  );

  try {
    const engine = new GateEngine();
    const evaluationResult = engine.evaluateGates(evalResults.metrics, gates, {
      evalRun: evalResults,
    });

    const passed = evaluationResult.passed;
    const summary = evaluationResult.gateResults
      .map((r) => `${r.passed ? '✅' : '❌'} ${r.gate.name}: ${r.passed ? 'PASSED' : 'FAILED'} - ${r.message ?? ''}`)
      .join('\n');

    logger.info(
      {
        passed,
        count: evaluationResult.totalCount,
        baseline: baselineResults?.run_id,
      },
      'Gate check completed'
    );

    return {
      content: [
        {
          type: 'text',
          text: `Gate Results: ${passed ? 'ALL PASSED' : 'SOME FAILED'}\n\n${summary}`,
        },
      ],
      isError: !passed,
    };
  } catch (error) {
    logger.error({ error }, 'Gate check failed');
    return {
      content: [{ type: 'text', text: `Gate check failed: ${(error as Error).message}` }],
      isError: true,
    };
  }
}

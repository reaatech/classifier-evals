/**
 * MCP Server implementation for classifier-evals
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@reaatech/classifier-evals';
import { runEvalTool } from './tools/run-eval.tool.js';
import { checkGatesTool } from './tools/check-gates.tool.js';
import { compareModelsTool } from './tools/compare-models.tool.js';
import { llmJudgeTool } from './tools/llm-judge.tool.js';
import { generateReportTool } from './tools/generate-report.tool.js';

const server = new Server(
  {
    name: 'classifier-evals',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'run_eval',
        description: 'Execute a full evaluation pipeline on a dataset',
        inputSchema: {
          type: 'object',
          properties: {
            dataset_path: {
              type: 'string',
              description: 'Path to the dataset file (CSV, JSON, JSONL)',
            },
            predictions: {
              type: 'array',
              description:
                'Array of prediction objects with text, label, predicted_label, confidence',
              items: {
                type: 'object',
              },
            },
            metrics: {
              type: 'array',
              description: 'Metrics to calculate',
              items: { type: 'string' },
            },
            output_format: {
              type: 'string',
              description: 'Output format (json, html)',
              enum: ['json', 'html'],
            },
          },
          required: ['dataset_path'],
        },
      },
      {
        name: 'check_gates',
        description: 'Evaluate regression gates for CI',
        inputSchema: {
          type: 'object',
          properties: {
            eval_results: {
              type: 'string',
              description: 'Path to evaluation results JSON',
            },
            gate_config: {
              type: 'string',
              description: 'Path to gate configuration YAML',
            },
            baseline_results: {
              type: 'string',
              description: 'Path to baseline results for comparison',
            },
          },
          required: ['eval_results', 'gate_config'],
        },
      },
      {
        name: 'compare_models',
        description: 'Compare two model evaluation results',
        inputSchema: {
          type: 'object',
          properties: {
            baseline_results: {
              type: 'string',
              description: 'Path to baseline model results',
            },
            candidate_results: {
              type: 'string',
              description: 'Path to candidate model results',
            },
          },
          required: ['baseline_results', 'candidate_results'],
        },
      },
      {
        name: 'llm_judge',
        description: 'Run LLM-as-judge on samples with cost tracking',
        inputSchema: {
          type: 'object',
          properties: {
            samples: {
              type: 'array',
              description: 'Samples to judge',
              items: { type: 'object' },
            },
            judge_model: {
              type: 'string',
              description: 'LLM model to use for judging',
            },
            consensus_count: {
              type: 'number',
              description: 'Number of judges for consensus',
              default: 1,
            },
            budget_limit: {
              type: 'number',
              description: 'Maximum budget in USD',
            },
          },
          required: ['samples', 'judge_model'],
        },
      },
      {
        name: 'generate_report',
        description: 'Generate a JSON or HTML report from evaluation results',
        inputSchema: {
          type: 'object',
          properties: {
            eval_results: {
              type: 'string',
              description: 'Path to evaluation results JSON',
            },
            format: {
              type: 'string',
              description: 'Report format',
              enum: ['json', 'html'],
            },
          },
          required: ['eval_results'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logger.info({ tool: name, params: args }, 'MCP tool called');

  try {
    switch (name) {
      case 'run_eval':
        return await runEvalTool(args as Record<string, unknown>);

      case 'check_gates':
        return await checkGatesTool(args as Record<string, unknown>);

      case 'compare_models':
        return await compareModelsTool(args as Record<string, unknown>);

      case 'llm_judge':
        return await llmJudgeTool(args as Record<string, unknown>);

      case 'generate_report':
        return await generateReportTool(args as Record<string, unknown>);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error({ error, tool: name }, 'Tool execution failed');
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${(error as Error).message}`,
    );
  }
});

/**
 * Starts the MCP server with stdio transport
 */
export async function startMCPServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server started with stdio transport');
}

export { server };

/**
 * generate_report MCP tool implementation
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { exportToHtml } from '@reaatech/classifier-evals-exporters';
import { exportToJson } from '@reaatech/classifier-evals-exporters';
import { loadEvalRunFromFile } from '@reaatech/classifier-evals';

export async function generateReportTool(args: Record<string, unknown>): Promise<CallToolResult> {
  const format = (args.format as string | undefined) ?? 'html';
  const evalRun =
    typeof args.eval_results === 'string'
      ? loadEvalRunFromFile(args.eval_results)
      : (args.eval_results as Parameters<typeof exportToHtml>[0] | undefined);

  if (!evalRun) {
    return {
      content: [{ type: 'text', text: 'Error: eval_results is required' }],
      isError: true,
    };
  }

  const rendered =
    format === 'json' ? (exportToJson({ evalRun }).json ?? '') : exportToHtml(evalRun).html;

  return {
    content: [{ type: 'text', text: rendered }],
  };
}

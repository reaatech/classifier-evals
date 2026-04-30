/**
 * HTML Exporter - Interactive HTML report generation
 */

import { logger } from '@reaatech/classifier-evals';
import type { EvalRun } from '@reaatech/classifier-evals';

export interface HtmlExportOptions {
  includeConfusionMatrix?: boolean;
  includePerClassMetrics?: boolean;
  includeBaselineComparison?: boolean;
  includeJudgeAnalysis?: boolean;
  title?: string;
}

export interface HtmlExportResult {
  success: boolean;
  target_type: 'html';
  exported_at: string;
  error?: string;
  location?: string;
  html: string;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
}

function generateHeatmapSVG(
  matrix: number[][],
  labels: string[],
  width: number = 600,
  height: number = 600,
): string {
  const n = labels.length;
  const cellSize = Math.min(width, height) / (n + 2);
  const offset = cellSize * 1.5;

  let svgContent =
    '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">';
  svgContent +=
    '<style>.cell{stroke:#fff;stroke-width:1}.label{font-family:monospace;font-size:12px;fill:#333}.value{font-family:monospace;font-size:11px;fill:#fff;text-anchor:middle;dominant-baseline:middle}.title{font-family:sans-serif;font-size:14px;fill:#333;font-weight:bold}</style>';

  const maxVal = Math.max(...matrix.flat());
  const getColor = (val: number): string => {
    const intensity = maxVal > 0 ? val / maxVal : 0;
    const r = Math.round(255 * (1 - intensity * 0.7));
    const g = Math.round(100 + 155 * intensity);
    const b = Math.round(200 * (1 - intensity));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };

  labels.forEach((label, i) => {
    const y = offset + i * cellSize + cellSize / 2;
    svgContent +=
      '<text x="' +
      (offset - 5) +
      '" y="' +
      y +
      '" text-anchor="end" class="label">' +
      escapeHtml(label) +
      '</text>';
  });

  labels.forEach((label, i) => {
    const x = offset + i * cellSize + cellSize / 2;
    const y = offset - 5;
    svgContent +=
      '<text x="' +
      x +
      '" y="' +
      y +
      '" text-anchor="middle" class="label" transform="rotate(-45 ' +
      x +
      ' ' +
      y +
      ')">' +
      escapeHtml(label) +
      '</text>';
  });

  matrix.forEach((row, i) => {
    row.forEach((val, j) => {
      const x = offset + j * cellSize;
      const y = offset + i * cellSize;
      const color = getColor(val);
      svgContent +=
        '<rect x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        cellSize +
        '" height="' +
        cellSize +
        '" fill="' +
        color +
        '" class="cell"/>';
      if (val > 0) {
        svgContent +=
          '<text x="' +
          (x + cellSize / 2) +
          '" y="' +
          (y + cellSize / 2) +
          '" class="value">' +
          escapeHtml(String(val)) +
          '</text>';
      }
    });
  });

  svgContent += '</svg>';
  return svgContent;
}

function generateBarChartSVG(
  labels: string[],
  values: number[],
  title: string,
  width: number = 600,
  height: number = 300,
): string {
  const maxValue = Math.max(...values, 0.01);
  const chartHeight = height - 60;
  const chartWidth = width - 100;
  const barWidth = Math.min(40, chartWidth / labels.length - 5);

  let svgContent =
    '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">';
  svgContent +=
    '<style>.bar{fill:#4CAF50;transition:fill 0.3s}.bar:hover{fill:#45a049}.label{font-family:monospace;font-size:10px;fill:#333}.value{font-family:sans-serif;font-size:12px;fill:#333}.title{font-family:sans-serif;font-size:14px;fill:#333;font-weight:bold}</style>';
  svgContent +=
    '<text x="' +
    width / 2 +
    '" y="20" text-anchor="middle" class="title">' +
    escapeHtml(title) +
    '</text>';

  labels.forEach((label, i) => {
    const value = values[i];
    if (value === undefined) {
      return;
    }
    const barHeight = (value / maxValue) * chartHeight;
    const x = 80 + i * (chartWidth / labels.length) + (chartWidth / labels.length - barWidth) / 2;
    const y = 40 + chartHeight - barHeight;
    svgContent +=
      '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      barWidth +
      '" height="' +
      barHeight +
      '" class="bar"/>';
    svgContent +=
      '<text x="' +
      (x + barWidth / 2) +
      '" y="' +
      (y - 5) +
      '" text-anchor="middle" class="value">' +
      (value * 100).toFixed(1) +
      '%</text>';
    svgContent +=
      '<text x="' +
      (x + barWidth / 2) +
      '" y="' +
      (height - 5) +
      '" text-anchor="middle" class="label">' +
      escapeHtml(label) +
      '</text>';
  });

  svgContent += '</svg>';
  return svgContent;
}

export function exportToHtml(evalRun: EvalRun, options?: HtmlExportOptions): HtmlExportResult {
  const opts = options ?? {};
  const includeConfusionMatrix = opts.includeConfusionMatrix !== false;
  const includePerClassMetrics = opts.includePerClassMetrics !== false;
  const includeBaselineComparison = opts.includeBaselineComparison === true;
  const includeJudgeAnalysis = opts.includeJudgeAnalysis !== false;
  const reportTitle = opts.title ?? `Classifier Evaluation Report - ${evalRun.run_id ?? 'unknown'}`;

  try {
    const timestamp = new Date().toLocaleString();
    const perClassData = evalRun.confusion_matrix.per_class;
    const labels = perClassData.map((p) => p.label);
    const avgPrecision =
      perClassData.length > 0
        ? perClassData.reduce((sum, p) => sum + p.precision, 0) / perClassData.length
        : 0;
    const avgRecall =
      perClassData.length > 0
        ? perClassData.reduce((sum, p) => sum + p.recall, 0) / perClassData.length
        : 0;
    const avgF1 =
      perClassData.length > 0
        ? perClassData.reduce((sum, p) => sum + p.f1, 0) / perClassData.length
        : 0;

    let html =
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' +
      escapeHtml(reportTitle) +
      '</title>\n  <style>\n    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:1200px;margin:0 auto;padding:20px;background:#f5f5f5}\n    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px;border-radius:12px;margin-bottom:30px}\n    .header h1{margin:0 0 10px}\n    .header p{margin:5px 0;opacity:.9}\n    .card{background:#fff;border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,.1)}\n    .card h2{margin-top:0;color:#333;border-bottom:2px solid #667eea;padding-bottom:10px}\n    .metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin:20px 0}\n    .metric-box{background:#f8f9fa;border-radius:8px;padding:16px;text-align:center;border-left:4px solid #667eea}\n    .metric-value{font-size:28px;font-weight:700;color:#667eea}\n    .metric-label{font-size:12px;color:#666;margin-top:4px}\n    .status-pass{color:#28a745}\n    .status-fail{color:#dc3545}\n    table{width:100%;border-collapse:collapse;margin:16px 0}\n    th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}\n    th{background:#f8f9fa;font-weight:600}\n    .svg-container{overflow-x:auto;margin:20px 0}\n    .footer{text-align:center;padding:20px;color:#666;font-size:12px}\n  </style>\n</head>\n<body>\n  <div class="header">\n    <h1>' +
      escapeHtml(reportTitle) +
      '</h1>\n    <p><strong>Samples:</strong> ' +
      evalRun.total_samples.toLocaleString() +
      '</p>\n    <p><strong>Generated:</strong> ' +
      escapeHtml(timestamp) +
      '</p>\n  </div>';

    html +=
      '\n  <div class="card">\n    <h2>Key Metrics</h2>\n    <div class="metrics-grid">\n      <div class="metric-box">\n        <div class="metric-value">' +
      (avgPrecision * 100).toFixed(1) +
      '%</div>\n        <div class="metric-label">Precision</div>\n      </div>\n      <div class="metric-box">\n        <div class="metric-value">' +
      (avgRecall * 100).toFixed(1) +
      '%</div>\n        <div class="metric-label">Recall</div>\n      </div>\n      <div class="metric-box">\n        <div class="metric-value">' +
      (avgF1 * 100).toFixed(1) +
      '%</div>\n        <div class="metric-label">F1 Score</div>\n      </div>\n    </div>\n  </div>';

    if (includeConfusionMatrix) {
      html +=
        '\n  <div class="card">\n    <h2>Confusion Matrix</h2>\n    <div class="svg-container">\n      ' +
        generateHeatmapSVG(evalRun.confusion_matrix.matrix, evalRun.confusion_matrix.labels) +
        '\n    </div>\n  </div>';
    }

    if (includePerClassMetrics && perClassData.length > 0) {
      const f1Scores = perClassData.map((p) => p.f1);
      html +=
        '\n  <div class="card">\n    <h2>Per-Class Metrics</h2>\n    <div class="svg-container">\n      ' +
        generateBarChartSVG(labels, f1Scores, 'F1 Score by Class') +
        '\n    </div>\n    <table>\n      <thead>\n        <tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr>\n      </thead>\n      <tbody>';
      perClassData.forEach((p) => {
        html +=
          '\n        <tr><td>' +
          escapeHtml(p.label) +
          '</td><td>' +
          (p.precision * 100).toFixed(1) +
          '%</td><td>' +
          (p.recall * 100).toFixed(1) +
          '%</td><td>' +
          (p.f1 * 100).toFixed(1) +
          '%</td><td>' +
          p.support +
          '</td></tr>';
      });
      html += '\n      </tbody>\n    </table>\n  </div>';
    }

    if (
      includeBaselineComparison &&
      evalRun.gate_results !== undefined &&
      evalRun.gate_results.length > 0
    ) {
      html +=
        '\n  <div class="card">\n    <h2>Regression Gates</h2>\n    <table>\n      <thead>\n        <tr><th>Gate</th><th>Result</th><th>Status</th></tr>\n      </thead>\n      <tbody>';
      evalRun.gate_results.forEach((result) => {
        const statusClass = result.passed ? 'status-pass' : 'status-fail';
        const statusText = result.passed ? 'PASS' : 'FAIL';
        html +=
          '\n        <tr><td>' +
          escapeHtml(result.name) +
          '</td><td>' +
          escapeHtml(result.message ?? '') +
          '</td><td class="' +
          statusClass +
          '"><strong>' +
          statusText +
          '</strong></td></tr>';
      });
      html += '\n      </tbody>\n    </table>\n  </div>';
    }

    if (includeJudgeAnalysis && evalRun.judged_results && evalRun.judged_results.length > 0) {
      const judgedSamples = evalRun.judged_results;
      const totalCost = judgedSamples.reduce((sum, s) => sum + (s.judge_cost ?? 0), 0);
      const avgCostPerSample = totalCost / judgedSamples.length;
      const correctCount = judgedSamples.filter((s) => s.judge_correct === true).length;
      const agreementRate = correctCount / judgedSamples.length;
      html +=
        '\n  <div class="card">\n    <h2>LLM Judge Results</h2>\n    <div class="metrics-grid">\n      <div class="metric-box">\n        <div class="metric-value">' +
        judgedSamples.length +
        '</div>\n        <div class="metric-label">Samples Judged</div>\n      </div>\n      <div class="metric-box">\n        <div class="metric-value">$' +
        totalCost.toFixed(4) +
        '</div>\n        <div class="metric-label">Total Cost</div>\n      </div>\n      <div class="metric-box">\n        <div class="metric-value">$' +
        avgCostPerSample.toFixed(4) +
        '</div>\n        <div class="metric-label">Avg Cost/Sample</div>\n      </div>\n      <div class="metric-box">\n        <div class="metric-value">' +
        (agreementRate * 100).toFixed(1) +
        '%</div>\n        <div class="metric-label">Judge Agreement</div>\n      </div>\n    </div>\n  </div>';
    }

    html +=
      '\n  <div class="footer">\n    <p>Generated by classifier-evals | v0.1.0</p>\n  </div>\n</body>\n</html>';

    logger.info({ runId: evalRun.run_id, htmlSize: html.length }, 'HTML export completed');

    return {
      success: true,
      target_type: 'html',
      exported_at: new Date().toISOString(),
      location: 'stdout',
      html,
    };
  } catch (error) {
    const err = error as Error;
    logger.error({ runId: evalRun.run_id, error: err.message }, 'HTML export failed');
    return {
      success: false,
      target_type: 'html',
      exported_at: new Date().toISOString(),
      error: err.message,
      html: '',
    };
  }
}

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release with core evaluation functionality
- Multi-format dataset loading (CSV, JSON, JSONL)
- Confusion matrix with per-class metrics
- Classification metrics (accuracy, precision, recall, F1, MCC, Cohen's kappa)
- LLM-as-judge with cost tracking and consensus voting
- Regression gates for CI integration
- Phoenix and Langfuse exporters
- MCP server implementation
- OpenTelemetry observability with tracing and metrics
- Dashboard for historical trend analysis
- CLI tool with eval, compare, judge, gates, and report commands

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## [0.1.0] - 2026-04-19

### Added
- Initial implementation of classifier-evals library
- Core domain types with Zod schemas
- Dataset loader supporting CSV, JSON, and JSONL formats
- Dataset validator with duplicate detection and distribution analysis
- Confusion matrix engine with multi-class support
- Classification metrics calculator
- LLM judge engine with batch processing
- Prompt templates for classification evaluation
- Consensus voting with majority, weighted, and unanimous strategies
- Cost tracker for LLM judge budget management
- Result aggregator with bias detection
- Regression gate engine with threshold, baseline, and distribution gates
- Gate evaluation with GitHub Actions and JUnit XML formatting
- JSON and HTML exporters
- Phoenix dataset exporter
- Langfuse traces exporter
- OpenTelemetry tracing spans
- Structured logging with PII redaction
- Dashboard metrics for trend analysis
- MCP server with tools for run_eval, compare_models, check_gates, llm_judge
- CLI commands: eval, compare, judge, gates, report
- Comprehensive unit tests
- Development documentation (CLAUDE.md)
- Docker support with multi-stage build
- CI/CD workflows for testing and release

[Unreleased]: https://github.com/reaatech/classifier-evals/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/reaatech/classifier-evals/releases/tag/v0.1.0

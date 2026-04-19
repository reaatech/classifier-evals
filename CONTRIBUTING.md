# Contributing to classifier-evals

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- npm 10+
- Docker (optional, for container testing)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/reaatech/classifier-evals.git
cd classifier-evals

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## Development Workflow

1. **Create a branch** — Use descriptive branch names (`feature/add-metric`, `fix/loader-bug`)
2. **Make changes** — Follow existing code patterns
3. **Write tests** — All new features need test coverage
4. **Run linting** — `npm run lint` must pass
5. **Open a PR** — Link to any related issues

## Project Structure

```
src/
├── types/          # Domain types and Zod schemas
├── dataset/        # Dataset loading and validation
├── metrics/        # Confusion matrix and classification metrics
├── judge/          # LLM-as-judge system
├── gates/          # Regression gates for CI
├── exporters/      # JSON, HTML exporters
├── cli/            # CLI commands
└── index.ts        # Library entry point

tests/
└── unit/           # Unit tests

datasets/examples/  # Example datasets
```

## Adding a New Metric

1. Add the metric calculation in `src/metrics/classification-metrics.ts`
2. Update the `ClassificationMetrics` type in `src/types/domain.ts`
3. Add unit tests in `tests/unit/classification-metrics.test.ts`
4. Update documentation in `README.md`

## Adding a New Gate Type

1. Create a new file in `src/gates/` (e.g., `custom-gates.ts`)
2. Implement the evaluation function
3. Add the gate type to `RegressionGate` in `src/types/domain.ts`
4. Update `GateEngine` to handle the new type
5. Add unit tests

## Adding a New Exporter

1. Create a new file in `src/exporters/` (e.g., `csv-exporter.ts`)
2. Implement the `Exporter` interface:
   ```typescript
   interface Exporter {
     export(evalRun: EvalRun): ExportResult;
   }
   ```
3. Add a CLI command in `src/cli/commands/` if needed
4. Add unit tests

## Code Style

- **TypeScript** — Strict mode enabled
- **Formatting** — Prettier (run `npm run format`)
- **Linting** — ESLint with typescript-eslint
- **Imports** — Use `.js` extension for ES modules
- **Naming** — camelCase for variables, PascalCase for types/classes

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add Matthews correlation coefficient`
- `fix: handle empty datasets in loader`
- `docs: update README with examples`
- `test: add unit tests for confusion matrix`

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/metrics.test.ts
```

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated (if applicable)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

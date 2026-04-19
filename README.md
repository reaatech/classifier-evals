# classifier-evals

Offline classifier evaluation harness for intent classification systems. Provides dataset loading, confusion matrices, LLM-as-judge with cost accounting, regression gates for CI, and Phoenix/Langfuse exporters.

## Quick Start

```bash
# Install
npm install -g classifier-evals

# Run evaluation on a dataset
classifier-evals eval --dataset test-set.csv --format json --output results.json

# Check regression gates
classifier-evals gates --results results.json --gates gates.yaml
```

## Features

- **Multi-format dataset loading** — CSV, JSON, JSONL
- **Confusion matrix analysis** — Multi-class matrices with per-class metrics
- **Classification metrics** — Accuracy, precision, recall, F1 (macro/micro/weighted), MCC, Cohen's kappa
- **LLM-as-judge** — Cost-aware evaluation with consensus voting
- **Regression gates** — CI-integrated quality gates with baseline comparison
- **Observability** — Phoenix and Langfuse exporters, OpenTelemetry tracing

## Dataset Format

### CSV

```csv
text,label,predicted_label,confidence
"Reset my password",password_reset,password_reset,0.95
"Cancel my subscription",cancel_subscription,refund_request,0.72
```

### JSONL

```jsonl
{"text": "Reset my password", "label": "password_reset", "predicted_label": "password_reset", "confidence": 0.95}
```

### Required Fields

| Field | Required | Description |
|-------|----------|-------------|
| `text` | yes | Input text that was classified |
| `label` | yes | Ground truth label |
| `predicted_label` | yes | Model's predicted label |
| `confidence` | no | Model's confidence score (0-1) |

## CLI Commands

### eval

Run a full evaluation pipeline:

```bash
classifier-evals eval \
  --dataset datasets/test-set.csv \
  --format json \
  --output results.json
```

### compare

Compare two model evaluations:

```bash
classifier-evals compare \
  --baseline results/model-v1.json \
  --candidate results/model-v2.json \
  --output comparison.json
```

### gates

Check regression gates for CI:

```bash
classifier-evals gates \
  --results results/latest.json \
  --gates gates.yaml
```

### judge

Run LLM-as-judge on samples:

```bash
classifier-evals judge \
  --samples misclassifications.jsonl \
  --model claude-opus \
  --budget 50.00
```

### export

Generate a report or send results to an exporter:

```bash
classifier-evals export \
  --results results/latest.json \
  --format html \
  --output reports/eval-report.html
```

## Regression Gates

Configure quality gates in YAML:

```yaml
# gates.yaml
gates:
  - name: overall-accuracy
    type: threshold
    metric: accuracy
    operator: ">="
    threshold: 0.85

  - name: macro-f1
    type: threshold
    metric: f1_macro
    operator: ">="
    threshold: 0.80

  - name: no-regression
    type: baseline-comparison
    baseline_path: results/baseline.json
    metric: f1_macro
    allow_regression_in: 0
```

## CI Integration

```yaml
# .github/workflows/eval.yml
name: Classifier Evaluation

on:
  pull_request:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run evaluation
        run: |
          npx classifier-evals eval \
            --dataset datasets/test-set.csv \
            --output results.json
      
      - name: Check gates
        run: |
          npx classifier-evals gates \
            --results results.json \
            --gates gates.yaml
```

## Library Usage

```typescript
import { loadDataset, createEvalRunFromSamples } from 'classifier-evals';

// Load dataset
const dataset = await loadDataset('test-set.csv');

// Create evaluation run (computes confusion matrix and all metrics)
const evalRun = createEvalRunFromSamples({
  samples: dataset.samples,
});

// Access results
console.log(`Accuracy: ${evalRun.metrics.accuracy}`);
console.log(`Macro F1: ${evalRun.metrics.f1_macro}`);
console.log(`Confusion matrix labels: ${evalRun.confusion_matrix.labels}`);
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for LLM judge |
| `ANTHROPIC_API_KEY` | Anthropic API key for LLM judge |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry endpoint |

## Documentation

- [AGENTS.md](AGENTS.md) — Agent development guide
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design deep dive
- [DEV_PLAN.md](DEV_PLAN.md) — Development checklist

## Performance Testing

Run the opt-in large-dataset performance suite separately from the default unit tests:

```bash
npm run test:perf
```

The performance suite uses deterministic synthetic datasets and validates the real loader,
metrics, and regression gate path on 10k+ samples.

## Deployment

### Infrastructure as Code

The `infra/` directory contains Terraform modules and environment configurations for deploying
classifier-evals to multiple cloud platforms:

#### AWS (Amazon Web Services)

Deploy to AWS using ECS Fargate:

```bash
cd infra/environments/aws-production
terraform init
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"
```

**Resources created:**
- ECS Cluster with Fargate service
- Application Load Balancer
- ECR repository for container images
- CloudWatch logs and alarms

#### Azure

Deploy to Azure using Container Apps:

```bash
cd infra/environments/azure-production
terraform init
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"
```

**Resources created:**
- Container Apps Environment
- Container App with autoscaling
- Container Registry
- Application Insights for monitoring

#### GCP (Google Cloud Platform)

Deploy to GCP using Cloud Run:

```bash
cd infra/environments/gcp-production
terraform init
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"
```

**Resources created:**
- Cloud Run service
- Cloud Build for CI/CD
- Artifact Registry
- Cloud Monitoring and Logging

#### OCI (Oracle Cloud Infrastructure)

Deploy to OCI using OKE (Kubernetes):

```bash
cd infra/environments/oci-production
terraform init
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"
```

**Resources created:**
- OKE Kubernetes cluster
- Load Balancer
- Container Engine for Kubernetes
- Monitoring and Logging

#### Netlify

Deploy to Netlify for serverless functions:

```bash
cd infra/environments/netlify-production
terraform init
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"
```

**Resources created:**
- Netlify site
- Serverless functions
- Custom domain configuration
- Build hooks for CI/CD

#### Vercel

Deploy to Vercel for edge functions:

```bash
cd infra/environments/vercel-production
terraform init
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"
```

**Resources created:**
- Vercel project
- Edge functions
- Preview deployments
- Custom domain configuration

### Docker Deployment

```bash
# Build the Docker image
docker build -t classifier-evals .

# Run locally
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  -e ANTHROPIC_API_KEY=your-key \
  classifier-evals

# Push to registry
docker tag classifier-evals registry.example.com/classifier-evals:latest
docker push registry.example.com/classifier-evals:latest
```

### Docker Compose (Development)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f classifier-evals

# Stop all services
docker-compose down
```

## Template Repository

This repository can be used as a GitHub template, but the actual "Template repository"
toggle is a GitHub repository setting and is not stored in source control. The repo-tracked
support here is the project structure and documentation needed for template consumers.

## License

MIT

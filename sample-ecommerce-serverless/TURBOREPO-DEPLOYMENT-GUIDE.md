# Turborepo Monorepo Deployment Guide

This guide explains how Turborepo enables **selective deployment** based on code changes, integrated with GitHub Actions for automated CI/CD.

---

## 📋 Table of Contents

- [What is Turborepo?](#what-is-turborepo)
- [How Turborepo Detects Changes](#how-turborepo-detects-changes)
- [Monorepo Structure](#monorepo-structure)
- [Turborepo Configuration](#turborepo-configuration)
- [GitHub Actions Integration](#github-actions-integration)
- [Deployment Workflows](#deployment-workflows)
- [Change Detection Examples](#change-detection-examples)
- [Cost Savings](#cost-savings)

---

## 🎯 What is Turborepo?

**Turborepo** is a high-performance build system for JavaScript/TypeScript monorepos.

### Key Features

1. **Smart Caching** - Never rebuild the same code twice
2. **Parallel Execution** - Run tasks across multiple cores
3. **Remote Caching** - Share cache across team and CI
4. **Dependency Graph** - Understands package relationships
5. **Selective Execution** - Only build/deploy what changed

### Why Use Turborepo?

```
Without Turborepo:
├─ Change orders-service
├─ Deploy ALL services (orders, inventory, catalog)
└─ Time: 15 minutes, Cost: 3x Lambda deployments

With Turborepo:
├─ Change orders-service
├─ Deploy ONLY orders-service
└─ Time: 5 minutes, Cost: 1x Lambda deployment
```

**Result: 3x faster, 3x cheaper!** 🚀

---

## 🔍 How Turborepo Detects Changes

### 1. Content-Based Hashing

Turborepo creates a hash of:
- Source files
- Dependencies (package.json)
- Configuration files
- Environment variables

```typescript
// Turborepo calculates hash
Hash = SHA256(
  sourceFiles +
  package.json +
  tsconfig.json +
  .env
)

// If hash changed → Rebuild
// If hash same → Use cache
```

### 2. Dependency Graph

Turborepo understands package relationships:

```
orders-service depends on:
├─ shared/domain-primitives
├─ shared/event-schemas
└─ shared/http-client

If shared/event-schemas changes:
└─ Rebuild orders-service (depends on it)
└─ Rebuild inventory-service (depends on it)
└─ Skip catalog-service (doesn't depend on it)
```

### 3. Git-Based Change Detection

```bash
# Turborepo compares current commit with previous
git diff HEAD^1 --name-only

# Changed files:
# services/orders-service/src/app.ts
# shared/event-schemas/src/order-events.ts

# Turborepo determines:
# → orders-service changed (direct)
# → inventory-service changed (depends on event-schemas)
# → catalog-service unchanged (no dependency)
```

---

## 🏗️ Monorepo Structure

```
sample-ecommerce-serverless/
├── package.json                    ← Root package (workspaces)
├── turbo.json                      ← Turborepo config
├── .github/
│   └── workflows/
│       ├── ci.yml                  ← Test all on PR
│       ├── deploy-orders.yml       ← Deploy orders on change
│       ├── deploy-inventory.yml    ← Deploy inventory on change
│       └── deploy-catalog.yml      ← Deploy catalog on change
├── services/
│   ├── orders-service/
│   │   ├── package.json            ← Service package
│   │   ├── src/
│   │   └── infrastructure/
│   ├── inventory-service/
│   │   ├── package.json
│   │   └── src/
│   └── catalog-service/
│       ├── package.json
│       └── src/
└── shared/
    ├── domain-primitives/
    │   └── package.json
    ├── event-schemas/
    │   └── package.json
    └── http-client/
        └── package.json
```

---

## ⚙️ Turborepo Configuration

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local",
    ".env"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "env": ["NODE_ENV", "AWS_REGION"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": true
    },
    "deploy": {
      "dependsOn": ["build", "test"],
      "cache": false,
      "outputs": []
    },
    "deploy:dev": {
      "dependsOn": ["build"],
      "cache": false,
      "outputs": []
    },
    "deploy:staging": {
      "dependsOn": ["build", "test"],
      "cache": false,
      "outputs": []
    },
    "deploy:prod": {
      "dependsOn": ["build", "test", "lint"],
      "cache": false,
      "outputs": []
    }
  }
}
```

### Key Configuration Explained

#### 1. `dependsOn`
```json
"build": {
  "dependsOn": ["^build"]  // ← Run build in dependencies first
}
```

**Example:**
```
orders-service depends on event-schemas
└─ Turborepo builds event-schemas first
└─ Then builds orders-service
```

#### 2. `outputs`
```json
"build": {
  "outputs": ["dist/**"]  // ← Cache these directories
}
```

**Example:**
```
First build:
└─ Compile TypeScript → dist/
└─ Cache dist/ with hash ABC123

Second build (no changes):
└─ Hash still ABC123
└─ Restore dist/ from cache (instant!)
```

#### 3. `cache`
```json
"deploy": {
  "cache": false  // ← Never cache deployments
}
```

**Why?** Deployments have side effects (AWS changes), so we never cache them.

---

## 🔄 GitHub Actions Integration

### Workflow 1: CI Pipeline (Test All)

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # ← Need previous commit for comparison
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      # Turborepo automatically detects what changed
      - name: Build changed packages
        run: npx turbo run build --filter=[HEAD^1]
      
      - name: Test changed packages
        run: npx turbo run test --filter=[HEAD^1]
      
      - name: Lint changed packages
        run: npx turbo run lint --filter=[HEAD^1]
```

**How it works:**
1. `--filter=[HEAD^1]` tells Turborepo to compare current commit with previous
2. Turborepo builds dependency graph
3. Only changed packages (and their dependents) are built/tested
4. Cached results used for unchanged packages

---

### Workflow 2: Deploy Orders Service

```yaml
# .github/workflows/deploy-orders.yml
name: Deploy Orders Service

on:
  push:
    branches: [main]
    paths:
      # Trigger only if these paths change
      - 'services/orders-service/**'
      - 'shared/**'
      - '.github/workflows/deploy-orders.yml'
  workflow_dispatch:  # Manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      
      - name: Install dependencies
        run: npm ci
      
      # Turborepo builds only orders-service and its dependencies
      - name: Build orders-service
        run: npx turbo run build --filter=orders-service
      
      # Deploy only orders-service
      - name: Deploy orders-service
        run: npx turbo run deploy --filter=orders-service
        env:
          NODE_ENV: production
      
      - name: Notify success
        if: success()
        run: |
          echo "✅ Orders Service deployed successfully"
          echo "Commit: ${{ github.sha }}"
          echo "Author: ${{ github.actor }}"
```

**Path-based triggering:**
```yaml
paths:
  - 'services/orders-service/**'  # Direct changes
  - 'shared/**'                   # Dependency changes
```

**Result:** Workflow only runs when orders-service or its dependencies change!

---

### Workflow 3: Deploy All Services (Manual)

```yaml
# .github/workflows/deploy-all.yml
name: Deploy All Services

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - staging
          - prod

jobs:
  deploy-all:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      
      - name: Install dependencies
        run: npm ci
      
      # Build all services in parallel
      - name: Build all services
        run: npx turbo run build
      
      # Deploy all services in parallel
      - name: Deploy all services
        run: npx turbo run deploy
        env:
          NODE_ENV: production
          ENVIRONMENT: ${{ github.event.inputs.environment }}
```

---

## 📊 Change Detection Examples

### Example 1: Change Only Orders Service

```bash
# Developer commits
git commit -m "feat(orders): add discount logic"
# Changed files:
# - services/orders-service/src/domain/models/order.ts

# GitHub Actions triggers
✅ deploy-orders.yml (path matched)
❌ deploy-inventory.yml (path not matched)
❌ deploy-catalog.yml (path not matched)

# Turborepo builds
✅ shared/domain-primitives (dependency)
✅ shared/event-schemas (dependency)
✅ orders-service (changed)
❌ inventory-service (cached)
❌ catalog-service (cached)

# Result
Deploy: orders-service only
Time: 5 minutes
Cost: 1x deployment
```

### Example 2: Change Shared Event Schema

```bash
# Developer commits
git commit -m "feat(shared): add discount field to OrderCreatedEvent"
# Changed files:
# - shared/event-schemas/src/order-events.ts

# GitHub Actions triggers
✅ deploy-orders.yml (shared/ path matched)
✅ deploy-inventory.yml (shared/ path matched)
❌ deploy-catalog.yml (doesn't use event-schemas)

# Turborepo builds
✅ shared/event-schemas (changed)
✅ orders-service (depends on event-schemas)
✅ inventory-service (depends on event-schemas)
❌ catalog-service (no dependency)

# Result
Deploy: orders-service + inventory-service
Time: 8 minutes
Cost: 2x deployments
```

### Example 3: Change Catalog Service

```bash
# Developer commits
git commit -m "feat(catalog): add product tags"
# Changed files:
# - services/catalog-service/src/domain/models/product.ts

# GitHub Actions triggers
❌ deploy-orders.yml (path not matched)
❌ deploy-inventory.yml (path not matched)
✅ deploy-catalog.yml (path matched)

# Turborepo builds
✅ catalog-service (changed)
❌ orders-service (cached)
❌ inventory-service (cached)

# Result
Deploy: catalog-service only
Time: 5 minutes
Cost: 1x deployment
```

---

## 💰 Cost Savings Analysis

### Scenario: 10 Deployments per Day

#### Without Turborepo (Deploy All)
```
Every commit deploys all 3 services:

Daily:
├─ 10 commits × 3 services = 30 deployments
├─ 30 × 5 minutes = 150 minutes
└─ 30 × $0.10 = $3.00

Monthly:
├─ 30 days × 30 deployments = 900 deployments
├─ 900 × 5 minutes = 4,500 minutes (75 hours!)
└─ 900 × $0.10 = $90.00
```

#### With Turborepo (Selective Deploy)
```
Typical distribution:
├─ 5 commits → orders-service only
├─ 3 commits → inventory-service only
├─ 1 commit → catalog-service only
└─ 1 commit → shared (affects 2 services)

Daily:
├─ 5 + 3 + 1 + (1 × 2) = 11 deployments
├─ 11 × 5 minutes = 55 minutes
└─ 11 × $0.10 = $1.10

Monthly:
├─ 30 days × 11 deployments = 330 deployments
├─ 330 × 5 minutes = 1,650 minutes (27.5 hours)
└─ 330 × $0.10 = $33.00

Savings:
├─ Time: 75 - 27.5 = 47.5 hours saved (63%)
└─ Cost: $90 - $33 = $57 saved (63%)
```

**Annual Savings: $684 + 570 hours!** 💰

---

## 🚀 Setup Instructions

### Step 1: Install Turborepo

```bash
cd sample-ecommerce-serverless
npm install turbo --save-dev
```

### Step 2: Create turbo.json

```bash
# Already created in previous steps
# See turbo.json configuration above
```

### Step 3: Update Root package.json

```json
{
  "name": "ecommerce-serverless-platform",
  "private": true,
  "workspaces": [
    "services/*",
    "shared/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "deploy:orders": "turbo run deploy --filter=orders-service",
    "deploy:inventory": "turbo run deploy --filter=inventory-service",
    "deploy:catalog": "turbo run deploy --filter=catalog-service",
    "deploy:all": "turbo run deploy",
    "deploy:changed": "turbo run deploy --filter=[HEAD^1]"
  },
  "devDependencies": {
    "turbo": "^1.10.16"
  }
}
```

### Step 4: Add Deploy Script to Each Service

```json
// services/orders-service/package.json
{
  "name": "orders-service",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/",
    "deploy": "cdk deploy OrdersServiceStack --require-approval never"
  }
}
```

### Step 5: Create GitHub Actions Workflows

```bash
# Already created in previous steps
# See .github/workflows/ examples above
```

### Step 6: Configure GitHub Secrets

```bash
# In GitHub repository settings → Secrets and variables → Actions

Add secrets:
├─ AWS_ACCESS_KEY_ID
├─ AWS_SECRET_ACCESS_KEY
└─ AWS_REGION
```

### Step 7: Test Locally

```bash
# Build only changed packages
npx turbo run build --filter=[HEAD^1]

# Deploy only orders service
npx turbo run deploy --filter=orders-service

# Deploy all services
npx turbo run deploy
```

---

## 🧪 Testing the Setup

### Test 1: Change Orders Service

```bash
# Make a change
echo "// test" >> services/orders-service/src/app.ts

# Commit and push
git add .
git commit -m "test(orders): trigger deployment"
git push origin main

# Expected:
# ✅ deploy-orders.yml runs
# ❌ deploy-inventory.yml skipped
# ❌ deploy-catalog.yml skipped
```

### Test 2: Change Shared Library

```bash
# Make a change
echo "// test" >> shared/event-schemas/src/order-events.ts

# Commit and push
git add .
git commit -m "test(shared): trigger deployments"
git push origin main

# Expected:
# ✅ deploy-orders.yml runs (depends on event-schemas)
# ✅ deploy-inventory.yml runs (depends on event-schemas)
# ❌ deploy-catalog.yml skipped (no dependency)
```

### Test 3: Manual Deploy All

```bash
# Go to GitHub Actions tab
# Select "Deploy All Services"
# Click "Run workflow"
# Choose environment: dev

# Expected:
# ✅ All services deploy in parallel
```

---

## 📈 Monitoring Deployments

### GitHub Actions Dashboard

```
Recent Deployments:
├─ Deploy Orders Service (#123) ✅ 5m 23s
├─ Deploy Inventory Service (#122) ✅ 5m 45s
├─ Deploy Orders Service (#121) ✅ 5m 12s
└─ Deploy All Services (#120) ✅ 8m 34s

Statistics:
├─ Success rate: 98%
├─ Average duration: 5m 30s
└─ Deployments this week: 47
```

### Turborepo Cache Stats

```bash
# Check cache hit rate
npx turbo run build --summarize

# Output:
Tasks:    3 successful, 3 total
Cached:   2 successful, 2 total
Time:     12.5s >>> FULL TURBO (2 cache hits)

Cache hit rate: 66%
```

---

## 🎯 Best Practices

### 1. Commit Message Convention

```bash
# Use conventional commits for clarity
feat(orders): add discount calculation
fix(inventory): resolve stock reservation bug
chore(shared): update event schema
docs(readme): update deployment guide

# Benefits:
# - Clear which service changed
# - Easy to generate changelogs
# - Automated versioning possible
```

### 2. Branch Strategy

```bash
main (production)
  ↑
  │ PR + CI
  │
develop (staging)
  ↑
  │ PR + CI
  │
feature/orders-discount
feature/inventory-alerts
```

### 3. Environment-Specific Deployments

```yaml
# Deploy to dev automatically on push to develop
on:
  push:
    branches: [develop]

# Deploy to prod manually after approval
on:
  workflow_dispatch:
    inputs:
      environment: prod
```

### 4. Rollback Strategy

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Turborepo will:
# 1. Detect changes (revert)
# 2. Rebuild affected services
# 3. Deploy previous version
```

---

## 🔧 Troubleshooting

### Issue 1: Cache Not Working

```bash
# Problem: Turborepo always rebuilds

# Solution: Check turbo.json outputs
{
  "build": {
    "outputs": ["dist/**"]  // ← Make sure this matches your build output
  }
}
```

### Issue 2: Wrong Services Deploying

```bash
# Problem: Catalog deploys when orders changes

# Solution: Check GitHub Actions paths
paths:
  - 'services/orders-service/**'  # ← Be specific
  - 'shared/**'
  # Don't use: '**/*' (too broad)
```

### Issue 3: Deployment Fails

```bash
# Problem: CDK deploy fails

# Solution: Check AWS credentials
aws sts get-caller-identity

# Check CDK bootstrap
cdk bootstrap aws://ACCOUNT-ID/REGION
```

---

## 📚 Summary

### What We Achieved

✅ **Selective Deployment** - Only changed services deploy  
✅ **Fast CI/CD** - Cached builds, parallel execution  
✅ **Cost Savings** - 63% fewer deployments  
✅ **Time Savings** - 63% faster deployments  
✅ **Automated** - Git commit triggers deployment  
✅ **Safe** - Tests run before deployment  

### Key Technologies

- **Turborepo** - Smart build system
- **GitHub Actions** - CI/CD automation
- **Path Filters** - Selective workflow triggers
- **Workspaces** - Monorepo package management
- **CDK** - Infrastructure as code

### Deployment Flow

```
Developer commits
    ↓
GitHub Actions triggered (path-based)
    ↓
Turborepo detects changes
    ↓
Build only changed packages (cached)
    ↓
Run tests
    ↓
Deploy to AWS (CDK)
    ↓
Notify success/failure
```

**Your monorepo is now production-ready with intelligent, cost-effective deployments!** 🎉

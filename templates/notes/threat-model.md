---
title: "{{title}}"
classification: confidential
status: draft
author: "{{author}}"
tags: [docs/threat-model]
created: "{{date}}"
system: "{{system}}"
methodology: STRIDE
export:
  pdf:
    watermark: heads-up
    toc: true
    tocDepth: 3
---

## Table of Contents

---

## System Overview

Brief description of the system being modeled.

```mermaid
graph LR
  A[Client] --> B[API Gateway]
  B --> C[Auth Service]
  B --> D[Core Service]
  D --> E[(Database)]
```

## Data Flow

| Source | Destination | Data | Classification |
|--------|-------------|------|----------------|
| Client | API Gateway | Requests | internal |
| API Gateway | Auth Service | Credentials | confidential |
| Core Service | Database | Records | confidential |

## Trust Boundaries

- **External boundary**: Client ↔ API Gateway
- **Internal boundary**: API Gateway ↔ Backend services
- **Data boundary**: Services ↔ Database

## STRIDE Analysis

### Spoofing

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| | | | |

### Tampering

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| | | | |

### Repudiation

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| | | | |

### Information Disclosure

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| | | | |

### Denial of Service

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| | | | |

### Elevation of Privilege

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| | | | |

## Risk Assessment

```mermaid
quadrantChart
  title Risk Matrix
  x-axis Low Impact --> High Impact
  y-axis Low Likelihood --> High Likelihood
  quadrant-1 Monitor
  quadrant-2 Mitigate
  quadrant-3 Accept
  quadrant-4 Transfer
```

## Mitigations

| ID | Threat | Mitigation | Status | Owner |
|----|--------|-----------|--------|-------|
| M1 | | | Planned | |

## Residual Risk

Summary of accepted residual risks after mitigations.

## Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| {{date}} | {{author}} | Initial assessment |

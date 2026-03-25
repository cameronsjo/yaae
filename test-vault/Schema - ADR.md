---
title: "ADR 001: Choose Testing Strategy"
classification: internal
status: draft
author: Test Author
tags: [docs/adr]
created: "2026-03-25"
adrNumber: 1
deciders: ["Test Author"]
---

## Status

**Proposed**

## Context

We need to verify that all README-claimed features actually work.

## Decision Drivers

- Manual testing is slow but catches visual bugs
- Automated testing is fast but cannot render CSS
- A combined approach covers both

## Considered Options

### Option 1: Manual Only

**Pros:**
- Catches visual regressions

**Cons:**
- Slow, easy to skip

### Option 2: Automated Only

**Pros:**
- Fast, repeatable

**Cons:**
- Cannot verify visual output

## Decision

Combined approach with test vault + automated wiring tests.

## Consequences

**Positive:**
- High confidence in feature correctness

**Negative:**
- More test infrastructure to maintain

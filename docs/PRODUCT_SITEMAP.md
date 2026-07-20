# GPUValidator Product Sitemap and Route Architecture

This document maps the intended product architecture against the current implementation. It does not authorize creating duplicate routes just because reference images use alternate terminology.

## Current routing implementation
The frontend is a Vite/React single-page application with manual path dispatch in `src/App.tsx`. Express in `server.ts` enforces the login-only public experience and serves API routes. Current implemented UI routes include:
- `/login`
- `/portal`
- `/portal/engagements`
- `/portal/engagements/new`
- `/portal/engagements/:id`
- `/portal/library`
- `/portal/library/:slug`
- `/portal/admin/users`
- `/portal/admin/users/new`
- `/portal/admin/users/:id`
- `/portal/admin/demo`
- `/portal/admin/system`

Unauthenticated `/` and legacy public paths redirect to `/login` in the current product.

## Intended hierarchy

```text
Public
├── Homepage
├── Features
├── Benchmarks
├── Pricing
├── Documentation
└── Company

Authentication
├── Login
├── Forgot Password
├── SSO
├── Request Access
└── Invite Acceptance

Application
├── Dashboard
├── Inventory
│   ├── GPUs
│   ├── Nodes
│   ├── Systems
│   └── Drivers
├── Clusters
│   ├── Cluster Overview
│   ├── Nodes
│   ├── GPUs
│   ├── Fabric
│   ├── Storage
│   ├── Jobs
│   └── Validation
├── Validation
│   ├── Validation Center
│   ├── Active Run
│   ├── Results
│   ├── Profiles
│   └── History
├── Benchmarks
│   ├── Benchmark Center
│   ├── NCCL
│   ├── HPL
│   ├── HPCG
│   ├── MLPerf
│   ├── Results
│   └── Comparisons
├── Monitoring
├── Alerts
├── Reports
├── AI Copilot
└── Settings

Administration
├── Users
├── Roles
├── Organizations
├── Integrations
├── API Keys
├── Agents
├── Audit Logs
├── Licensing
└── Billing
```

## Adaptation to current product
- Dashboard maps to current `/portal` classic validation portal, but the redesign should eventually use `/dashboard` or alias `/portal` to dashboard.
- Clusters, inventory, validation results, and benchmarks currently exist inside engagement workflows and the classic portal rather than separate route modules.
- Administration currently focuses on users, demo, and system health.
- Public marketing routes are not active because the current release intentionally enforces login-only public access.
- AI Copilot, pricing, billing, and MLPerf are future or roadmap surfaces and must not be mocked as functional.

## Route manifest
Machine-readable route intent lives in `design/manifests/routes.json` with page ID, route, category, reference image, implementation status, dependencies, priority, and notes.

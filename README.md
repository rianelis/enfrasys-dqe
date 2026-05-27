# Enfrasys DQE - Deal Qualification Engine

Enfrasys DQE is a Transformation prototype that supports structured opportunity qualification, technical risk assessment, and proposal readiness. It is intended to help BD and solutioning teams assess tenders/RFPs consistently before committing presales and delivery effort.

The prototype converts an Excel-based qualification framework into a reusable web application with guided intake, service scope mapping, capability scoring, delivery risk scoring, approval workflow, saved assessments, and PDF export.

## Why This Exists

Deal qualification is often handled through manual review, scattered notes, individual experience, and repeated discussions across BD, presales, solutioning, and delivery teams. This creates inconsistent decisions and makes it harder to explain why an opportunity should proceed, be escalated, or be paused.

DQE provides a structured checkpoint before proposal effort is committed. It helps teams capture the same information, apply the same scoring model, and produce a clearer recommendation for management review.

## Transformation KPI Alignment

DQE supports the 2026 Transformation KPI by productizing a manual presales process into a structured digital workflow.

It demonstrates:

- Process standardization for deal qualification.
- Reusable assessment data instead of one-off spreadsheet reviews.
- Clearer risk visibility before proposal commitment.
- Better management review through scoring, recommendations, approval status, and PDF reporting.
- A foundation for future AI-assisted proposal support using internal knowledge.

## BD Process Flow Alignment

DQE is designed to fit inside the BD process flow for tenders, POs, and sales orders as a technical and commercial qualification checkpoint.

| BD stage | DQE role |
| --- | --- |
| Tender/RFP received | Create a DQE assessment |
| Initial qualification | Score opportunity fit |
| Technical review | Validate scope, capability, and risks |
| Proposal decision | Recommend proceed, caution, escalate, or no-go |
| Proposal development | Capture assumptions, exclusions, and clarification points |
| Management approval | Submit, approve, reject, or request revision |
| PO / sales order | Reuse approved scope and assumptions as reference |

## Prototype Scope

Current prototype capabilities:

- Dashboard with assessment history.
- Requirement intake and deal overview form.
- Service scope checklist.
- Capability scoring.
- Risk matrix for development, time, and operations.
- Editable assessment-level scoring weights.
- Central admin scoring configuration for default weights, thresholds, and recommendation rules.
- Saved assessments using backend persistence.
- PostgreSQL support for production deployment.
- Approval workflow with draft, submitted, approved, rejected, and revision states.
- PDF export / download report.
- Rule-based recommendation output.
- Basic AI recommendation extension point.

## Technology Stack

- React + TypeScript frontend.
- Vite development/build tooling.
- Express + Node.js backend API.
- Shared TypeScript scoring engine.
- PostgreSQL for production persistence.
- SQLite fallback for local prototype usage.
- jsPDF for report export.
- Azure Container Apps deployment.

## Live Prototype

Azure deployment:

```text
https://enfrasys-dqe.politecliff-7166fcf2.southeastasia.azurecontainerapps.io/
```

GitHub repository:

```text
https://github.com/rianelis/enfrasys-dqe
```

## How To Run Locally

Install dependencies:

```powershell
npm install
```

Run the frontend and backend together:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Run checks:

```powershell
npm run check
npm test
npm run build
```

## Environment Configuration

For local prototype usage, the app can fall back to SQLite.

For production, configure PostgreSQL:

```text
DATABASE_URL=postgresql://user:password@host:5432/database
PGSSL=true
```

Do not commit real credentials. Use `.env.example` as the template.

## Demo Scenario

Example demo case:

| Field | Example |
| --- | --- |
| Customer | Prolintas |
| Opportunity | TCS Cloud Modernisation POC |
| Owner | Spyros |
| Sector | Transportation / Highway |
| Deal value | RM 1M-5M or unknown |
| Timeline | 3-6 months |
| Procurement type | Direct / RFP |
| Services | Azure Infrastructure, Hybrid Cloud, Security, Managed Services |
| Key risks | Vendor dependency, timeline, scope clarity, operations/SLA |

Use the demo case to create an assessment, review the score, submit for approval, and export the PDF report.

## Screenshots And Evidence

The repository includes a screenshot evidence pack:

| File | Purpose |
| --- | --- |
| `screenshots/01-dashboard.png` | Shows assessment dashboard |
| `screenshots/02-overview.png` | Shows opportunity intake |
| `screenshots/03-service-scope.png` | Shows selected services |
| `screenshots/04-capability.png` | Shows capability scoring |
| `screenshots/05-risk-matrix.png` | Shows risk scoring |
| `screenshots/06-score.png` | Shows recommendation |
| `screenshots/07-pdf-export.png` | Shows PDF export action |
| `screenshots/08-admin.png` | Shows configurable scoring/admin |
| `screenshots/dqe-demo-report.pdf` | Exported demo report evidence |

## Roadmap

Recommended next improvements:

- Expand service catalogue with Enfrasys-specific offerings such as AI / GenAI Solutioning, Microsoft Fabric / Data Platform, Application Modernisation, Integration / API / Middleware, VMS / Smart City / IoT, and Managed Services / Support Model.
- Add commercial qualification scoring including budget confirmation, decision maker, funding source, strategic account value, partner dependency, margin confidence, submission effort, and win probability.
- Make the service catalogue fully editable as admin data.
- Add role-based access control for admin and approver actions.
- Improve AI-generated recommendations using deal notes, risks, selected services, and capability gaps.
- Add scenario comparison for current scope, reduced scope, partner-supported scope, and extended timeline.

## Related Report

The supporting evaluation report is available at:

```text
docs/tech-evaluation-report.md
```

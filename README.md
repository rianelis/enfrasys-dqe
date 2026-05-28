# Enfrasys DQE - Deal Qualification Engine

Enfrasys DQE is a Transformation prototype that supports structured opportunity
qualification, technical risk assessment, and proposal readiness. It is intended
to help BD and solutioning teams assess tenders/RFPs consistently before
committing presales and delivery effort.

The prototype converts an Excel-based qualification framework into a reusable
web application with guided intake, service scope mapping, capability scoring,
delivery risk scoring, approval workflow, saved assessments, and PDF export.

## Why This Exists

Deal qualification is often handled through manual review, scattered notes,
individual experience, and repeated discussions across BD, presales,
solutioning, and delivery teams. This creates inconsistent decisions and makes
it harder to explain why an opportunity should proceed, be escalated, or be
paused.

DQE provides a structured checkpoint before proposal effort is committed. It
helps teams capture the same information, apply the same scoring model, and
produce a clearer recommendation for management review.

## Transformation KPI Alignment

DQE supports the 2026 Transformation KPI by productizing a manual presales
process into a structured digital workflow.

It demonstrates:

- Process standardization for deal qualification.
- Reusable assessment data instead of one-off spreadsheet reviews.
- Clearer risk visibility before proposal commitment.
- Better management review through scoring, recommendations, approval status,
  and PDF reporting.
- A foundation for future AI-assisted proposal support using internal knowledge.

## BD Process Flow Alignment

DQE is designed to fit inside the BD process flow for tenders, POs, and sales
orders as a technical and commercial qualification checkpoint.

The DQE prototype is intended to complement the BD process flow by acting as a
structured qualification checkpoint during the tender/RFP stage. It helps BD and
solutioning teams assess technical fit, commercial readiness, delivery risk, and
proposal readiness before committing effort. Once an opportunity proceeds, the
approved DQE assessment can be used as a reference for proposal development, PO
processing, and sales order handover.

| BD stage              | DQE role                                                  |
| --------------------- | --------------------------------------------------------- |
| Tender / RFP Received | Create DQE opportunity intake                             |
| Initial qualification | Check basic commercial and technical fit                  |
| Technical review      | Validate service scope, capability, and risks             |
| Proposal decision     | Recommend proceed, conditions, escalation, or no-go       |
| Proposal development  | Capture assumptions, exclusions, and clarification points |
| Management approval   | Submit, approve, reject, or request revision              |
| PO / SO reference     | Reuse approved scope and assumptions as handover evidence |

## Prototype Scope

Current prototype capabilities:

- Dashboard with assessment history.
- Tender/RFP intake and deal overview form.
- BD process alignment tracker.
- Commercial qualification inputs and scoring for budget, decision maker,
  funding, partner dependency, margin confidence, win probability, proposal
  status, and PO/SO reference.
- Enfrasys service scope checklist with 30 catalogue services across cloud,
  application/integration, data/AI, security, industry, and managed/advisory
  portfolios.
- Capability scoring.
- Risk matrix for development, time, and operations.
- Editable assessment-level scoring weights.
- Central admin scoring configuration for default weights, thresholds, and
  recommendation rules.
- Saved assessments using backend persistence.
- PostgreSQL support for production deployment.
- Approval workflow with draft, submitted, approved, rejected, and revision
  states.
- PDF export / download report.
- Rule-based recommendation output.
- Gemini-powered AI recommendation support with deterministic fallback.

## Service Catalogue

The prototype now uses an Enfrasys-specific read-only service catalogue instead
of a generic cloud list.

| Portfolio                   | Example services                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Cloud & Infrastructure      | Azure Landing Zone, Azure Infrastructure, Cloud Migration, Hybrid Connectivity, Backup & DR                    |
| Application & Integration   | Application Modernisation, API / Middleware Integration, Containerisation, DevOps / CI/CD                      |
| Data, AI & Analytics        | Microsoft Fabric, Data Platform, AI / GenAI Solutions, RAG / Knowledge Search, BI & Reporting                  |
| Security & Governance       | Zero Trust, IAM, Defender / XDR, Compliance & Governance, SOC / Monitoring                                     |
| Industry Solutions          | Smart City / IoT, VMS / Video Analytics, Toll / Transport Systems, Dynamics 365 / Business Applications        |
| Managed & Advisory Services | Managed Services, Assessment / Workshop, Architecture Advisory, Training & Adoption, FinOps                    |

## Technology Stack

- React + TypeScript frontend.
- Vite development/build tooling.
- Express + Node.js backend API.
- Shared TypeScript scoring engine.
- PostgreSQL for production persistence.
- SQLite fallback for local prototype usage.
- Gemini API for AI-assisted recommendations.
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
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Do not commit real credentials. Use `.env.example` as the template.

## Demo Scenario

The live Azure prototype includes two saved demo assessments in PostgreSQL:

| Customer  | Opportunity                        | Purpose                                                                       | Status               |
| --------- | ---------------------------------- | ----------------------------------------------------------------------------- | -------------------- |
| Prolintas | TCS Cloud Modernisation POC        | Cloud modernisation and managed operations qualification                      | Proceed With Caution |
| MCMC      | Dynamics 365 Smart City Assessment | Dynamics 365, Smart City, integration, data, security, and support qualification | Proceed With Caution |

Use these records to demonstrate dashboard history, reopen/save behaviour,
scoring, risk review, approval workflow, Gemini AI recommendation, and PDF
export.

To create a new assessment, use this basic flow:

1. Start from Dashboard.
2. Select New Assessment.
3. Complete Overview required fields.
4. Select Service Scope.
5. Score Capability and Risk.
6. Review Score and recommendation.
7. Export PDF or submit for approval.

## Screenshots And Evidence

The repository includes a screenshot evidence pack:

| File                                                           | Purpose                                   |
| -------------------------------------------------------------- | ----------------------------------------- |
| `screenshots/01-dashboard.png`                                 | Shows assessment dashboard                |
| `screenshots/02-overview.png`                                  | Shows opportunity intake                  |
| `screenshots/03-service-scope.png`                             | Shows selected services                   |
| `screenshots/04-capability.png`                                | Shows capability scoring                  |
| `screenshots/05-risk-matrix.png`                               | Shows risk scoring                        |
| `screenshots/06-score.png`                                     | Shows recommendation                      |
| `screenshots/07-pdf-export.png`                                | Shows PDF export action                   |
| `screenshots/08-admin.png`                                     | Shows configurable scoring/admin          |
| `screenshots/dqe-demo-report.pdf`                              | Exported demo report evidence             |
| `demo-output/prolintas-tcs-cloud-modernisation-dqe-report.pdf` | Exported Prolintas demo assessment report |

## Roadmap

Recommended next improvements:

- Make the service catalogue editable from Admin so portfolio owners can add,
  disable, describe, and classify Enfrasys offerings without changing code.
- Expand BD commercial scoring with strategic account value, submission effort,
  competitor position, procurement confidence, and commercial approval route.
- Add role-based access control for admin and approver actions.
- Improve Gemini-generated recommendations with internal templates, assumptions,
  exclusions, and BD guidebook content.
- Add scenario comparison for current scope, reduced scope, partner-supported
  scope, and extended timeline.

## Related Report

The supporting evaluation report is available at:

```text
docs/tech-evaluation-report.md
```

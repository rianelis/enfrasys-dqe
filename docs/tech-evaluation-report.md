# Tech Evaluation Report: Enfrasys Deal Qualification Engine

## Executive Summary

The Enfrasys Deal Qualification Engine (DQE) is a Transformation prototype for structured opportunity qualification, technical risk assessment, and proposal readiness. It converts an Excel-based assessment model into a reusable web application that BD, presales, solutioning, and delivery teams can use before committing effort to tenders, RFPs, and proposal work.

The recommended approach is to start with a structured workflow and scoring engine, then extend it with document-based knowledge search and AI-assisted recommendations. This avoids the risk of trying to train a custom AI model too early, while still creating a practical foundation for internal AI adoption.

## Business Problem

Current deal qualification can depend heavily on manual review, scattered documents, and individual experience. This creates several issues:

- Opportunity decisions may be inconsistent across teams.
- Technical risk may be identified too late in the proposal process.
- BD and presales effort may be spent on weak or unclear opportunities.
- Management review may lack a clear scoring basis.
- Assumptions, exclusions, and clarification points may not be captured consistently.

The result is avoidable rework, unclear ownership, and difficulty connecting technical qualification to the wider BD process flow.

## Proposed Solution

DQE provides a structured decision workflow for deal qualification. Users capture deal details, select relevant services, score capability, evaluate delivery risks, generate a recommendation, and submit the assessment for review.

The application acts as a qualification checkpoint before proposal commitment. It does not replace BD judgement, but it gives the team a repeatable process and evidence base for decisions.

## Technology Evaluated

The prototype considered the following technology directions:

| Technology | Evaluation |
| --- | --- |
| Excel framework | Useful for defining logic, but manual and static for wider team usage |
| React web app | Suitable for guided forms, reusable workflow, dashboard, and reporting |
| Node.js API | Suitable for lightweight backend orchestration and scoring endpoints |
| PostgreSQL | Suitable for persistent multi-user production data |
| SQLite | Useful for local prototype fallback |
| Azure Container Apps | Suitable for deploying the prototype as a reviewable internal web app |
| Gemini API | Used for AI-assisted executive recommendation generation with `gemini-3.1-flash-lite` |
| Azure AI / private AI model | Future option for recommendations and proposal assistance |
| RAG / document search | Recommended AI starting point using internal documents and guidebooks |

## Recommended Approach

The recommended approach is to start with RAG plus structured workflow, not full model training from scratch.

RAG is more suitable for the next phase because it can use internal process documents, service catalogues, proposal templates, assumptions, exclusions, and historical examples without needing a custom trained model. The structured DQE workflow should remain the source of assessment data, while AI can help generate recommendations and proposal support content.

## Prototype Scope

The current prototype demonstrates:

| Module | Purpose |
| --- | --- |
| Dashboard | List previous assessments, scores, owners, status, and last updated date |
| Requirement Intake | Capture customer requirement, tender/RFP summary, timeline, budget, scope, and sector |
| Service Scope | Select services relevant to the opportunity |
| Capability Match | Score delivery confidence and capability alignment |
| Risk Matrix | Assess development, time, and operations risks |
| Qualification Score | Calculate score and recommendation |
| Approval Workflow | Submit, approve, reject, or request revision |
| PDF Export | Produce a downloadable qualification summary |
| Admin Configuration | Manage scoring defaults, thresholds, and recommendation rules |
| Gemini Recommendation | Generate AI-assisted executive guidance from deal notes, selected services, risks, and scoring output |

## Alignment To BD Process

DQE should be positioned as a technical qualification checkpoint inside the wider BD process flow being prepared for tenders, POs, sales orders, and team reference guidance.

| BD stage | DQE role |
| --- | --- |
| Tender/RFP received | Create a DQE assessment |
| Initial qualification | Score opportunity fit and readiness |
| Technical review | Validate service scope, capability, dependencies, and delivery risks |
| Proposal decision | Recommend proceed, proceed with conditions, clarify, escalate, or no-go |
| Proposal development | Capture assumptions, exclusions, clarification questions, and SOW inputs |
| Management approval | Submit the assessment for approval or revision |
| PO / sales order | Use approved scope, risks, and assumptions as reference |

This makes DQE complementary to the BD framework rather than a separate standalone tool.

## Alignment To Transformation KPI

DQE supports the Transformation KPI by digitizing and standardizing a manual qualification process.

Transformation value:

- Converts spreadsheet logic into an operational web application.
- Improves consistency in tender/RFP assessment.
- Creates reusable data for review and reporting.
- Provides a foundation for AI-assisted proposal support.
- Supports smoother cross-functional collaboration between BD, presales, solutioning, and delivery.

Positioning statement:

> This Excel framework was used to define the logic, but it was converted into a structured decision engine that can now be deployed as a web application for scalable presales usage.

## Demo Scenario

The live Azure prototype includes two saved demo assessments in PostgreSQL:

| Customer | Opportunity | Purpose | Result |
| --- | --- |
| Prolintas | TCS Cloud Modernisation POC | Demonstrates cloud modernisation, hybrid readiness, security, and managed operations qualification | Proceed With Caution |
| Cypark | Smart City / VMS Platform Assessment | Demonstrates Smart City / VMS, integration/API dependency, security, data platform, and support model qualification | Proceed With Caution |

Demo flow:

1. Open the live Azure dashboard.
2. Open the Prolintas or Cypark demo assessment.
3. Review the Overview, Service Scope, Capability, and Risk pages.
4. Review the recommendation and top risks on the Score page.
5. Generate the Gemini AI recommendation.
6. Submit for approval or export the PDF report.

## Screenshots And Evidence

The repository includes the following evidence pack:

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
| `demo-output/prolintas-tcs-cloud-modernisation-dqe-report.pdf` | Exported Prolintas demo assessment report |

## Limitations

Current limitations:

- Service catalogue is still read-only.
- Commercial qualification factors are not fully scored yet.
- Gemini recommendation is enabled, but it should be expanded later with internal knowledge, proposal templates, assumptions, exclusions, and BD guidebook content.
- Role-based access control is not yet implemented.
- BD process alignment is documented but not yet embedded as a full workflow module.

## Roadmap

Recommended next phase:

1. Expand the service catalogue for Enfrasys internal offerings:
   - AI / GenAI Solutioning.
   - Microsoft Fabric / Data Platform.
   - Application Modernisation.
   - Integration / API / Middleware.
   - VMS / Smart City / IoT.
   - Managed Services / Support Model.
2. Add commercial qualification scoring:
   - Budget confirmed.
   - Decision maker identified.
   - Funding source known.
   - Strategic account value.
   - Partner dependency.
   - Margin confidence.
   - Submission effort required.
   - Win probability.
3. Make the service catalogue editable through admin configuration.
4. Add role-based access for admins, owners, and approvers.
5. Add RAG-based proposal assistant using internal templates, service descriptions, assumptions, exclusions, and BD guidebook content.
6. Improve executive PDF report layout with Enfrasys branding, charts, metadata, and approval/signature section.

## Final Assessment

DQE is already a credible functional prototype. It demonstrates the core engine, workflow, scoring, persistence, approval, reporting, and deployment foundation required for the prototype deliverable.

The remaining improvement areas are deeper BD commercial scoring, editable service catalogue governance, and richer AI-assisted proposal support. The README, report, screenshots, and demo evidence now position the prototype clearly against the Transformation KPI.

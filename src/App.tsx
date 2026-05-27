import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  XCircle,
  type LucideIcon
} from "lucide-react";
import {
  calculateDqe,
  defaultInput,
  DqeInput,
  DqeResult,
  groupLabels,
  RiskGroup,
  riskFactors,
  ScoreThresholds,
  ServiceGroup,
  services
} from "./engine/scoring";

const steps = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "requirements", label: "Service Scope", icon: ListChecks },
  { id: "capability", label: "Capability", icon: SlidersHorizontal },
  { id: "risk", label: "Risk", icon: AlertTriangle },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "admin", label: "Admin", icon: Settings },
  { id: "score", label: "Score", icon: Gauge },
  { id: "help", label: "Help", icon: HelpCircle }
] as const;

type StepId = (typeof steps)[number]["id"];
type ApprovalStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Needs Revision";
type AutosaveState = "idle" | "saving" | "saved" | "error";

type AdminConfig = {
  defaultWeights: Record<RiskGroup, number>;
  thresholds: ScoreThresholds;
  recommendationRules: string;
};

type AssessmentSummary = {
  id: string;
  title: string;
  customer: string;
  owner: string;
  statusLabel: string;
  score: number;
  approvalStatus: ApprovalStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  approver: string;
  approvalNotes: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type AssessmentRecord = {
  id: string;
  title: string;
  input: DqeInput;
  result: DqeResult;
  approvalStatus: ApprovalStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  approver: string;
  approvalNotes: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

const serviceGroups: ServiceGroup[] = ["cloud", "appIntegration", "dataAi", "security", "industry", "managedAdvisory"];
const riskGroups: RiskGroup[] = ["development", "time", "operations"];
const requiredOverviewFields: Array<keyof DqeInput["overview"]> = ["customer", "owner", "dealValue", "sector", "timeline"];

const selectOptions = {
  contactRole: ["CIO/CTO", "IT Director", "IT Manager", "Procurement Officer", "Project Manager", "C-Suite (non-IT)", "End User"],
  stage: ["Initial Enquiry", "RFP/ITT Received", "Proof of Concept", "Active Negotiation", "Verbal Agreement"],
  dealValue: ["Below RM 100K", "RM 100K - RM 500K", "RM 500K - RM 1M", "RM 1M - RM 5M", "Above RM 5M"],
  sector: [
    "Government (Federal)",
    "Government (State/Local)",
    "Financial Services",
    "Healthcare",
    "Education",
    "Oil & Gas",
    "Telecommunications",
    "Manufacturing",
    "Retail/FMCG",
    "Commercial Enterprise",
    "Other"
  ],
  timeline: ["< 1 month", "1-3 months", "3-6 months", "6-12 months", "> 12 months"],
  procurementType: ["Open Tender", "Direct Negotiation", "Quotation", "Panel Contract", "Framework Agreement", "MyCloud / LAKSANA"]
};

const newAssessmentInput: DqeInput = {
  ...defaultInput,
  overview: {
    ...defaultInput.overview,
    customer: "",
    opportunity: "",
    owner: "",
    contactName: "",
    dealValue: "",
    sector: "",
    timeline: "",
    deadlineDate: "",
    notes: ""
  }
};

const cloneInput = (input: DqeInput) => JSON.parse(JSON.stringify(input)) as DqeInput;

const defaultAdminConfig: AdminConfig = {
  defaultWeights: defaultInput.weights,
  thresholds: {
    greenMax: 2.5,
    amberMax: 3.5
  },
  recommendationRules:
    "Green: proceed with standard governance.\nAmber: confirm capacity, resolve flagged risks, add contingency.\nRed: escalate to leadership before committing."
};

const loadAdminConfig = () => {
  const stored = localStorage.getItem("dqe-admin-config");
  return stored ? (JSON.parse(stored) as AdminConfig) : defaultAdminConfig;
};

function validateInput(input: DqeInput) {
  const labels: Partial<Record<keyof DqeInput["overview"], string>> = {
    customer: "Customer / Organisation",
    owner: "Owner",
    dealValue: "Deal Value",
    sector: "Sector",
    timeline: "Timeline"
  };

  const fieldErrors = requiredOverviewFields
    .filter((field) => !input.overview[field].trim())
    .map((field) => `${labels[field] ?? field} is required.`);

  const weightTotal = Object.values(input.weights).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(weightTotal - 1) > 0.001) {
    fieldErrors.push("Risk weights must total 100%.");
  }

  return fieldErrors;
}

function getCompletion(input: DqeInput) {
  const selectedServices = services.filter((service) => input.requiredServices[service.id]);
  const weightTotal = Object.values(input.weights).reduce((sum, weight) => sum + weight, 0);

  return {
    dashboard: true,
    overview: requiredOverviewFields.every((field) => input.overview[field].trim()),
    requirements: selectedServices.length > 0,
    capability: selectedServices.every((service) => {
      const score = input.capability[service.id];
      return score && score.skills >= 1 && score.tools >= 1 && score.experience >= 1;
    }),
    risk: riskFactors.every((factor) => input.risk[factor.id] >= 1 && input.risk[factor.id] <= 5),
    settings: Math.abs(weightTotal - 1) <= 0.001,
    admin: true,
    score: validateInput(input).length === 0,
    help: true
  } satisfies Record<StepId, boolean>;
}

function App() {
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(() => loadAdminConfig());
  const [adminConfigLoaded, setAdminConfigLoaded] = useState(false);
  const [input, setInput] = useState<DqeInput>(() => ({ ...cloneInput(newAssessmentInput), weights: loadAdminConfig().defaultWeights }));
  const [activeStep, setActiveStep] = useState<StepId>("dashboard");
  const [apiResult, setApiResult] = useState<DqeResult | null>(null);
  const [apiState, setApiState] = useState<"syncing" | "synced" | "offline">("syncing");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [savedAssessments, setSavedAssessments] = useState<AssessmentSummary[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("Draft");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approver, setApprover] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "fallback" | "error">("idle");

  const validationErrors = useMemo(() => validateInput(input), [input]);
  const isValid = validationErrors.length === 0;
  const localResult = useMemo(() => calculateDqe(input, adminConfig.thresholds), [input, adminConfig.thresholds]);
  const result = apiResult ?? localResult;
  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  const completion = useMemo(() => getCompletion(input), [input]);
  const pageTitle =
    activeStep === "dashboard"
      ? "Deal assessments"
      : activeStep === "help"
        ? "User help"
        : activeStep === "admin"
          ? "Admin configuration"
          : activeStep === "settings"
            ? "Scoring settings"
            : activeStep === "requirements"
              ? "Service scope"
              : input.overview.opportunity || "New assessment";

  useEffect(() => {
    void loadAssessmentList();
    void loadServerAdminConfig();
  }, []);

  useEffect(() => {
    localStorage.setItem("dqe-admin-config", JSON.stringify(adminConfig));
    if (!adminConfigLoaded) return;

    const timeout = window.setTimeout(() => {
      void fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminConfig)
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [adminConfig, adminConfigLoaded]);

  useEffect(() => {
    const hasStarted = Boolean(
      input.overview.customer.trim() ||
        input.overview.opportunity.trim() ||
        input.overview.owner.trim() ||
        input.overview.notes.trim()
    );
    if (!hasStarted) return;

    setAutosaveState("saving");
    const timeout = window.setTimeout(() => {
      void saveAssessment({ source: "auto" });
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [input, assessmentId]);

  useEffect(() => {
    if (!isValid) {
      setApiResult(null);
      setApiState("offline");
      return;
    }

    const controller = new AbortController();
    setApiState("syncing");

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, thresholds: adminConfig.thresholds }),
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error("API scoring failed");
        return response.json() as Promise<DqeResult>;
      })
      .then((payload) => {
        setApiResult(payload);
        setApiState("synced");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiResult(null);
        setApiState("offline");
      });

    return () => controller.abort();
  }, [input, isValid, adminConfig.thresholds]);

  const loadAssessmentList = async () => {
    try {
      const response = await fetch("/api/assessments");
      if (!response.ok) throw new Error("Unable to load assessments");
      setSavedAssessments((await response.json()) as AssessmentSummary[]);
    } catch {
      setSavedAssessments([]);
    }
  };

  const loadServerAdminConfig = async () => {
    try {
      const response = await fetch("/api/admin/config");
      if (!response.ok) throw new Error("Unable to load admin config");
      const config = (await response.json()) as AdminConfig;
      setAdminConfig(config);
      setAdminConfigLoaded(true);
    } catch {
      setAdminConfigLoaded(true);
    }
  };

  const saveAssessment = async (options: { source: "manual" | "auto" } = { source: "manual" }): Promise<AssessmentRecord | null> => {
    if (options.source === "manual") setSaveState("saving");
    try {
      const response = await fetch(assessmentId ? `/api/assessments/${assessmentId}` : "/api/assessments", {
        method: assessmentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, thresholds: adminConfig.thresholds })
      });
      if (!response.ok) throw new Error("Unable to save assessment");

      const record = (await response.json()) as AssessmentRecord;
      setAssessmentId(record.id);
      setApiResult(record.result);
      setApprovalStatus(record.approvalStatus);
      setApprover(record.approver);
      setApprovalNotes(record.approvalNotes);
      setAutosaveState("saved");
      if (options.source === "manual") setSaveState("saved");
      await loadAssessmentList();
      return record;
    } catch {
      setAutosaveState("error");
      if (options.source === "manual") setSaveState("error");
      return null;
    }
  };

  const applyApproval = async (action: "submit" | "approve" | "reject" | "revision") => {
    const saved = assessmentId ? null : await saveAssessment();
    const id = assessmentId ?? saved?.id;
    if (!id) return;

    const response = await fetch(`/api/assessments/${id}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, approver, notes: approvalNotes })
    });
    if (!response.ok) return;

    const record = (await response.json()) as AssessmentRecord;
    setAssessmentId(record.id);
    setApprovalStatus(record.approvalStatus);
    setApprover(record.approver);
    setApprovalNotes(record.approvalNotes);
    await loadAssessmentList();
  };

  const openAssessment = async (id: string) => {
    const response = await fetch(`/api/assessments/${id}`);
    if (!response.ok) return;

    const record = (await response.json()) as AssessmentRecord;
    setAssessmentId(record.id);
    setInput(record.input);
    setApiResult(record.result);
    setApprovalStatus(record.approvalStatus);
    setApprover(record.approver);
    setApprovalNotes(record.approvalNotes);
    setActiveStep("overview");
    setSaveState("idle");
  };

  const archiveAssessment = async (id: string) => {
    const summary = savedAssessments.find((assessment) => assessment.id === id);
    const confirmed = window.confirm(`Archive "${summary?.title ?? "this assessment"}"? It will be removed from the dashboard history.`);
    if (!confirmed) return;

    const response = await fetch(`/api/assessments/${id}`, { method: "DELETE" });
    if (!response.ok) return;

    if (assessmentId === id) {
      setAssessmentId(null);
      setInput({ ...cloneInput(newAssessmentInput), weights: adminConfig.defaultWeights });
      setApiResult(null);
      setApprovalStatus("Draft");
      setApprover("");
      setApprovalNotes("");
      setActiveStep("dashboard");
      setSaveState("idle");
      setAutosaveState("idle");
    }
    await loadAssessmentList();
  };

  const startNewAssessment = () => {
    setAssessmentId(null);
    setInput({ ...cloneInput(newAssessmentInput), weights: adminConfig.defaultWeights });
    setApiResult(null);
    setApprovalStatus("Draft");
    setApprover("");
    setApprovalNotes("");
    setActiveStep("overview");
    setSaveState("idle");
    setAutosaveState("idle");
  };

  const applyAdminConfigToAssessment = () => {
    setInput((current) => ({
      ...current,
      weights: adminConfig.defaultWeights
    }));
  };

  const generateAiRecommendation = async () => {
    setAiState("loading");
    setAiRecommendation("");

    try {
      const response = await fetch("/api/ai-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, result, thresholds: adminConfig.thresholds })
      });
      const payload = (await response.json()) as { recommendation: string; source: "gemini" | "fallback" };
      setAiRecommendation(payload.recommendation);
      setAiState(payload.source === "gemini" ? "ready" : "fallback");
    } catch {
      setAiRecommendation(result.recommendation);
      setAiState("error");
    }
  };

  const exportPdf = () => {
    if (!isValid) {
      setActiveStep("overview");
      return;
    }

    const doc = new jsPDF();
    const title = input.overview.opportunity || "DQE Assessment";
    const fileName = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "dqe-assessment"}.pdf`;

    doc.setFillColor(16, 35, 28);
    doc.rect(0, 0, 210, 30, "F");
    doc.setFillColor(240, 201, 95);
    doc.rect(14, 9, 12, 12, "F");
    doc.setTextColor(16, 35, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("E", 18, 17);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("Enfrasys Deal Qualification Report", 32, 17);
    doc.setTextColor(23, 33, 28);
    doc.setProperties({
      title: `DQE Report - ${title}`,
      subject: "Enfrasys Deal Qualification Engine report",
      author: "Enfrasys DQE",
      creator: "Enfrasys DQE"
    });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${input.overview.customer}`, 14, 42);
    doc.text(`Opportunity: ${title}`, 14, 50);
    doc.text(`Owner: ${input.overview.owner}`, 14, 58);
    doc.text(`Approval: ${approvalStatus}`, 14, 66);
    doc.text(`Version: DQE 0.1`, 14, 74);
    doc.text(`Sector: ${input.overview.sector}`, 112, 42);
    doc.text(`Deal Value: ${input.overview.dealValue}`, 112, 50);
    doc.text(`Timeline: ${input.overview.timeline}`, 112, 58);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 112, 66);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`Decision: ${result.statusLabel}`, 14, 84);
    doc.text(`Weighted Risk Score: ${result.weightedRiskScore.toFixed(2)}`, 14, 94);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Selected Services: ${result.selectedServices}`, 14, 104);
    doc.text(`Capability Score: ${result.capabilityScore?.toFixed(2) ?? "N/A"}`, 14, 112);

    doc.setFont("helvetica", "bold");
    doc.text("Risk Breakdown", 14, 128);
    doc.setFont("helvetica", "normal");
    const chartRows = [
      ...riskGroups.map((group) => ({ label: groupLabels[group], value: result.riskAverages[group], weight: `${Math.round(input.weights[group] * 100)}%` })),
      { label: "Capability Score", value: result.capabilityScore ?? 0, weight: "alignment" }
    ];
    chartRows.forEach((row, index) => {
      const y = 140 + index * 10;
      doc.text(`${row.label}: ${row.value.toFixed(2)} (${row.weight})`, 14, y);
      doc.setFillColor(238, 242, 236);
      doc.rect(112, y - 4, 70, 4, "F");
      doc.setFillColor(row.label === "Capability Score" ? 31 : 168, row.label === "Capability Score" ? 122 : 103, row.label === "Capability Score" ? 77 : 18);
      doc.rect(112, y - 4, Math.min((row.value / 5) * 70, 70), 4, "F");
    });

    doc.setFont("helvetica", "bold");
    doc.text("Score Explanation", 14, 186);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(result.explanations.map((explanation) => `- ${explanation}`).join("\n"), 180), 14, 196);

    doc.setFont("helvetica", "bold");
    doc.text("Recommendation", 14, 230);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(result.recommendation, 180), 14, 240);

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.text("Risk Flags", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(result.flags.map((flag) => `- ${flag}`).join("\n"), 180), 14, 28);
    doc.setFont("helvetica", "bold");
    doc.text("Approval & Sign-off", 14, 116);
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${approvalStatus}`, 14, 128);
    doc.text(`Approver: ${approver || "Pending"}`, 14, 136);
    doc.text(doc.splitTextToSize(`Notes: ${approvalNotes || "None"}`, 180), 14, 144);
    doc.line(14, 190, 90, 190);
    doc.line(114, 190, 190, 190);
    doc.text("Solution Architect", 14, 198);
    doc.text("Management Approver", 114, 198);
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(215, 223, 216);
      doc.line(14, 282, 196, 282);
      doc.setFontSize(9);
      doc.setTextColor(102, 115, 107);
      doc.text(`Enfrasys DQE - v0.1 - Page ${page} of ${pageCount}`, 14, 288);
    }
    doc.save(fileName);
  };

  const updateOverview = (key: keyof DqeInput["overview"], value: string) => {
    setSaveState("idle");
    setInput((current) => ({
      ...current,
      overview: { ...current.overview, [key]: value }
    }));
  };

  const updateRequired = (serviceId: string, required: boolean) => {
    setSaveState("idle");
    setInput((current) => ({
      ...current,
      requiredServices: { ...current.requiredServices, [serviceId]: required }
    }));
  };

  const updateCapability = (serviceId: string, key: keyof DqeInput["capability"][string], value: number) => {
    setSaveState("idle");
    setInput((current) => ({
      ...current,
      capability: {
        ...current.capability,
        [serviceId]: {
          ...current.capability[serviceId],
          [key]: value
        }
      }
    }));
  };

  const updateRisk = (factorId: string, value: number) => {
    setSaveState("idle");
    setInput((current) => ({
      ...current,
      risk: { ...current.risk, [factorId]: value }
    }));
  };

  const updateWeight = (group: RiskGroup, value: number) => {
    setSaveState("idle");
    setInput((current) => ({
      ...current,
      weights: { ...current.weights, [group]: value / 100 }
    }));
  };

  const moveStep = (direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(activeIndex + direction, 0), steps.length - 1);
    setActiveStep(steps[nextIndex].id);
  };

  return (
    <main className="app-shell">
      <aside className="left-rail" aria-label="DQE workflow">
        <div className="brand-lockup">
          <div className="brand-mark">E</div>
          <div>
            <p>Enfrasys</p>
            <strong>DQE</strong>
          </div>
        </div>

        <nav className="step-nav">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                className={`${step.id === activeStep ? "step-button active" : "step-button"} ${completion[step.id] ? "complete" : ""}`}
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                type="button"
              >
                <Icon size={18} aria-hidden="true" />
                <span>{step.label}</span>
              </button>
            );
          })}
        </nav>

        <SavedAssessments summaries={savedAssessments} activeId={assessmentId} onOpen={openAssessment} onDashboard={() => setActiveStep("dashboard")} />

        <div className={`sync-pill ${activeStep === "dashboard" ? "synced" : apiState}`}>
          <span />
          {activeStep === "dashboard"
            ? "Dashboard"
            : activeStep === "help"
              ? "Help"
            : apiState === "syncing"
              ? "Scoring"
              : apiState === "synced"
                ? "API synced"
                : isValid ? "Local mode" : "Needs details"}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Technical Deal Qualification</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="action-cluster">
            <button className="primary-top-action" onClick={startNewAssessment} type="button">
              <Plus size={18} aria-hidden="true" />
              New Assessment
            </button>
            <button className="icon-action" onClick={() => void saveAssessment()} title="Save assessment" type="button">
              <Save size={18} aria-hidden="true" />
              <span>Save</span>
            </button>
            <button className="icon-action" disabled={!isValid} onClick={exportPdf} title="Download report" type="button">
              <Download size={18} aria-hidden="true" />
              <span>PDF</span>
            </button>
            <button className="icon-action" onClick={() => setInput(cloneInput(defaultInput))} title="Load sample assessment" type="button">
              <RotateCcw size={18} aria-hidden="true" />
              <span>Sample</span>
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section className="step-panel">
            {activeStep !== "dashboard" && activeStep !== "help" && activeStep !== "admin" && validationErrors.length > 0 && <ValidationBanner errors={validationErrors} />}
            {saveState !== "idle" && <SaveBanner state={saveState} />}

            {activeStep === "dashboard" && (
              <DashboardStep
                summaries={savedAssessments}
                activeId={assessmentId}
                onOpen={openAssessment}
                onArchive={archiveAssessment}
                onNew={startNewAssessment}
              />
            )}
            {activeStep === "overview" && (
              <OverviewStep input={input} updateOverview={updateOverview} validationErrors={validationErrors} />
            )}
            {activeStep === "requirements" && <RequirementsStep input={input} updateRequired={updateRequired} />}
            {activeStep === "capability" && <CapabilityStep input={input} updateCapability={updateCapability} />}
            {activeStep === "risk" && <RiskStep input={input} updateRisk={updateRisk} />}
            {activeStep === "settings" && <SettingsStep input={input} updateWeight={updateWeight} />}
            {activeStep === "admin" && (
              <AdminSettings config={adminConfig} onChange={setAdminConfig} onApply={applyAdminConfigToAssessment} />
            )}
            {activeStep === "help" && <HelpStep onStart={startNewAssessment} />}
            {activeStep === "score" && (
              <ScoreStep
                result={result}
                input={input}
                validationErrors={validationErrors}
                completion={completion}
                approvalStatus={approvalStatus}
                aiRecommendation={aiRecommendation}
                aiState={aiState}
                thresholds={adminConfig.thresholds}
                onGenerateAi={generateAiRecommendation}
                onExport={exportPdf}
                onGoToOverview={() => setActiveStep("overview")}
              />
            )}

            <div className="step-controls">
              <button disabled={activeIndex === 0} onClick={() => moveStep(-1)} type="button">
                <ChevronLeft size={18} aria-hidden="true" />
                Previous
              </button>
              <button disabled={activeIndex === steps.length - 1} onClick={() => moveStep(1)} type="button">
                Next
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </section>

          {activeStep === "dashboard" ? (
            <DashboardSummaryPanel summaries={savedAssessments} onNew={startNewAssessment} />
          ) : activeStep === "help" ? (
            <HelpSummaryPanel onStart={startNewAssessment} />
          ) : activeStep === "admin" ? (
            <AdminSummaryPanel config={adminConfig} />
          ) : (
            <ResultPanel
              result={result}
              input={input}
              validationErrors={validationErrors}
              approvalStatus={approvalStatus}
              approver={approver}
              approvalNotes={approvalNotes}
              autosaveState={autosaveState}
              onApproverChange={setApprover}
              onApprovalNotesChange={setApprovalNotes}
              onApprovalAction={applyApproval}
              onSave={() => void saveAssessment()}
              onExport={exportPdf}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function SavedAssessments({
  summaries,
  activeId,
  onOpen,
  onDashboard
}: {
  summaries: AssessmentSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDashboard: () => void;
}) {
  return (
    <section className="saved-list" aria-label="Saved assessments">
      <button className="saved-title saved-title-button" onClick={onDashboard} type="button">
        <FolderOpen size={16} aria-hidden="true" />
        <span>Saved</span>
      </button>
      {summaries.length === 0 ? (
        <p>No saved assessments yet.</p>
      ) : (
        summaries.slice(0, 6).map((summary) => (
          <button className={summary.id === activeId ? "saved-item active" : "saved-item"} key={summary.id} onClick={() => onOpen(summary.id)} type="button">
            <strong>{summary.title}</strong>
            <span>{summary.customer || "No customer"} - {summary.owner || "Unassigned"} - {summary.score.toFixed(2)}</span>
          </button>
        ))
      )}
    </section>
  );
}

function HelpStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="panel-flow">
      <SectionTitle icon={HelpCircle} title="How to Fill a DQE Assessment" />
      <section className="help-intro">
        <div>
          <strong>Use DQE before committing presales effort.</strong>
          <p>
            Fill the assessment with the best information available at qualification stage. The goal is not perfection; the goal is a consistent view of deal fit, risk, capability, and next action.
          </p>
          <p>
            The live Azure dashboard includes two demo assessments: Prolintas TCS Cloud Modernisation POC and Cypark Smart City / VMS Platform Assessment.
          </p>
        </div>
        <button className="primary-action" onClick={onStart} type="button">
          <Plus size={16} aria-hidden="true" />
          Start New Assessment
        </button>
      </section>

      <div className="help-grid">
        <article className="help-card">
          <span>1</span>
          <strong>Overview</strong>
          <p>Enter the basic deal details first. Required fields are customer, owner, deal value, sector, and timeline.</p>
          <ul>
            <li>Customer / Organisation: the account or agency name.</li>
            <li>Owner: the Enfrasys person responsible for follow-up.</li>
            <li>Deal Value: estimated commercial size.</li>
            <li>Sector: customer industry or public-sector category.</li>
            <li>Timeline: how urgent the expected delivery or submission is.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>2</span>
          <strong>Service Scope</strong>
          <p>Select the Enfrasys services that are actually required for this deal. These selections drive the capability scoring section.</p>
          <ul>
            <li>Use the portfolio groups to scan cloud, application, data/AI, security, industry, and managed/advisory services.</li>
            <li>Select only services in scope for this opportunity.</li>
            <li>Leave uncertain services unchecked until confirmed.</li>
            <li>Use the notes field in Overview for unclear requirements.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>3</span>
          <strong>Capability</strong>
          <p>Rate readiness for each selected service. Use the sliders as a practical presales confidence check.</p>
          <ul>
            <li>Skills: team knowledge and certifications.</li>
            <li>Tools: available accelerators, platforms, and templates.</li>
            <li>Experience: similar delivery history or references.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>4</span>
          <strong>Risk</strong>
          <p>Score risk from 1 to 5. Lower is safer, higher needs mitigation or approval before commitment.</p>
          <ul>
            <li>1: low risk, normal delivery confidence.</li>
            <li>3: moderate risk, needs attention.</li>
            <li>5: high risk, escalation or scope change likely needed.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>5</span>
          <strong>Settings</strong>
          <p>Use weights only when the assessment needs a different emphasis. For most users, keep the default weights.</p>
          <ul>
            <li>Development: solution complexity and build risk.</li>
            <li>Time: deadline and approval timing risk.</li>
            <li>Operations: support, SLA, and run-state risk.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>6</span>
          <strong>Score</strong>
          <p>Review the final decision, top risks, recommendation, approval status, and export the PDF when ready.</p>
          <ul>
            <li>Green: proceed with normal governance.</li>
            <li>Amber: proceed with mitigation actions.</li>
            <li>Red: escalate before committing scope or timeline.</li>
            <li>Use Generate to create a Gemini-assisted executive recommendation when the API key is configured.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>7</span>
          <strong>Approval</strong>
          <p>Use approval actions after the assessment has enough detail for review.</p>
          <ul>
            <li>Submit: send the assessment for management or solution review.</li>
            <li>Approve: confirm the current scope and recommendation.</li>
            <li>Revise: request updates before proceeding.</li>
            <li>Reject: mark the opportunity as not qualified in its current form.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>8</span>
          <strong>PDF Export</strong>
          <p>Export the result when you need to share the qualification summary with managers or attach evidence to the BD review.</p>
          <ul>
            <li>Export after reviewing top risks and recommended next action.</li>
            <li>Use notes to capture assumptions, exclusions, and clarification points.</li>
            <li>Keep the exported report as evidence for the Transformation prototype review.</li>
          </ul>
        </article>
      </div>

      <section className="help-callout">
        <strong>Recommended workflow</strong>
        <p>Dashboard &gt; New Assessment &gt; Overview &gt; Service Scope &gt; Capability &gt; Risk &gt; Score &gt; Generate AI Recommendation &gt; Save / Export / Submit for approval.</p>
      </section>
    </div>
  );
}

function DashboardStep({
  summaries,
  activeId,
  onOpen,
  onArchive,
  onNew
}: {
  summaries: AssessmentSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"updated" | "scoreHigh" | "scoreLow" | "status">("updated");
  const owners = Array.from(new Set(summaries.map((summary) => summary.owner).filter(Boolean))).sort();
  const approvalStatuses: Array<ApprovalStatus | "All"> = ["All", "Draft", "Submitted", "Approved", "Rejected", "Needs Revision"];
  const filteredSummaries = summaries
    .filter((summary) => {
      const haystack = `${summary.title} ${summary.customer} ${summary.owner} ${summary.statusLabel} ${summary.approvalStatus}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    })
    .filter((summary) => ownerFilter === "All" || summary.owner === ownerFilter)
    .filter((summary) => statusFilter === "All" || summary.approvalStatus === statusFilter || summary.statusLabel === statusFilter)
    .sort((a, b) => {
      if (sortBy === "scoreHigh") return b.score - a.score;
      if (sortBy === "scoreLow") return a.score - b.score;
      if (sortBy === "status") return `${a.approvalStatus}${a.statusLabel}`.localeCompare(`${b.approvalStatus}${b.statusLabel}`);
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return (
    <div className="panel-flow">
      <SectionTitle icon={LayoutDashboard} title="Assessment History" />
      <div className="dashboard-filters">
        <label className="field search-field">
          <span>Search</span>
          <div>
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, owner, status..." />
          </div>
        </label>
        <SelectField label="Owner" value={ownerFilter} options={["All", ...owners]} onChange={setOwnerFilter} />
        <SelectField label="Approval" value={statusFilter} options={approvalStatuses} onChange={setStatusFilter} />
        <SelectField
          label="Sort"
          value={sortBy}
          options={["updated", "scoreHigh", "scoreLow", "status"]}
          optionLabels={{
            updated: "Last updated",
            scoreHigh: "Score high to low",
            scoreLow: "Score low to high",
            status: "Status"
          }}
          onChange={(value) => setSortBy(value as typeof sortBy)}
        />
      </div>
      <div className="history-table">
        <div className="history-head">
          <span>Deal</span>
          <span>Score</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Approval</span>
          <span>Last Updated</span>
          <span>Action</span>
        </div>
        {filteredSummaries.length === 0 ? (
          <div className="history-empty">
            <strong>No matching assessments</strong>
            <span>Create a deal assessment or adjust the filters to find saved work.</span>
            <button className="primary-action" onClick={onNew} type="button">
              <Plus size={16} aria-hidden="true" />
              New Assessment
            </button>
          </div>
        ) : (
          filteredSummaries.map((summary) => (
            <div className={summary.id === activeId ? "history-row active" : "history-row"} key={summary.id}>
              <span>
                <strong>{summary.title}</strong>
                <small>{summary.customer || "No customer"}</small>
              </span>
              <strong>{summary.score.toFixed(2)}</strong>
              <span>{summary.statusLabel}</span>
              <span>{summary.owner || "Unassigned"}</span>
              <span className="approval-pill">{summary.approvalStatus}</span>
              <span>{new Date(summary.updatedAt).toLocaleString()}</span>
              <span className="history-actions">
                <button onClick={() => onOpen(summary.id)} type="button">Open</button>
                <button className="danger-action" onClick={() => onArchive(summary.id)} type="button">
                  <Archive size={14} aria-hidden="true" />
                  Archive
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OverviewStep({
  input,
  updateOverview
}: {
  input: DqeInput;
  updateOverview: (key: keyof DqeInput["overview"], value: string) => void;
  validationErrors: string[];
}) {
  return (
    <div className="panel-flow">
      <SectionTitle icon={Building2} title="Deal Overview" />
      <div className="form-grid">
        <TextField required label="Customer / Organisation" value={input.overview.customer} onChange={(value) => updateOverview("customer", value)} />
        <TextField label="Opportunity / Project" value={input.overview.opportunity} onChange={(value) => updateOverview("opportunity", value)} />
        <TextField required label="Owner" value={input.overview.owner} onChange={(value) => updateOverview("owner", value)} />
        <TextField label="Primary Contact" value={input.overview.contactName} onChange={(value) => updateOverview("contactName", value)} />
        <SelectField label="Contact Role" value={input.overview.contactRole} options={selectOptions.contactRole} onChange={(value) => updateOverview("contactRole", value)} />
        <SelectField label="Deal Stage" value={input.overview.stage} options={selectOptions.stage} onChange={(value) => updateOverview("stage", value)} />
        <SelectField required label="Deal Value" value={input.overview.dealValue} options={selectOptions.dealValue} onChange={(value) => updateOverview("dealValue", value)} />
        <SelectField required label="Sector" value={input.overview.sector} options={selectOptions.sector} onChange={(value) => updateOverview("sector", value)} />
        <SelectField required label="Timeline" value={input.overview.timeline} options={selectOptions.timeline} onChange={(value) => updateOverview("timeline", value)} />
        <SelectField label="Procurement Type" value={input.overview.procurementType} options={selectOptions.procurementType} onChange={(value) => updateOverview("procurementType", value)} />
        <TextField label="Submission Date" type="date" value={input.overview.deadlineDate} onChange={(value) => updateOverview("deadlineDate", value)} />
      </div>
      <label className="field wide">
        <span>Technical Requirements & Notes</span>
        <textarea value={input.overview.notes} onChange={(event) => updateOverview("notes", event.target.value)} rows={5} />
      </label>
    </div>
  );
}

function RequirementsStep({
  input,
  updateRequired
}: {
  input: DqeInput;
  updateRequired: (serviceId: string, required: boolean) => void;
}) {
  return (
    <div className="panel-flow">
      <SectionTitle icon={ListChecks} title="Service Scope" />
      {serviceGroups.map((group) => (
        <div className="group-block" key={group}>
          <h2>{groupLabels[group]}</h2>
          <div className="service-list">
            {services
              .filter((service) => service.group === group)
              .map((service) => (
                <label className="toggle-row" key={service.id}>
                  <input
                    checked={input.requiredServices[service.id]}
                    onChange={(event) => updateRequired(service.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span className="toggle-control" aria-hidden="true">
                    <Check size={14} />
                  </span>
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.description}</small>
                  </span>
                </label>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CapabilityStep({
  input,
  updateCapability
}: {
  input: DqeInput;
  updateCapability: (serviceId: string, key: keyof DqeInput["capability"][string], value: number) => void;
}) {
  const selectedServices = services.filter((service) => input.requiredServices[service.id]);

  return (
    <div className="panel-flow">
      <SectionTitle icon={SlidersHorizontal} title="Capability Match" />
      <div className="slider-table">
        {selectedServices.map((service) => {
          const score = input.capability[service.id];
          return (
            <div className="score-row" key={service.id}>
              <div>
                <strong>{service.name}</strong>
                <small>{service.description}</small>
              </div>
              <Slider label="Skills" value={score.skills} onChange={(value) => updateCapability(service.id, "skills", value)} />
              <Slider label="Tools" value={score.tools} onChange={(value) => updateCapability(service.id, "tools", value)} />
              <Slider label="Experience" value={score.experience} onChange={(value) => updateCapability(service.id, "experience", value)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskStep({ input, updateRisk }: { input: DqeInput; updateRisk: (factorId: string, value: number) => void }) {
  return (
    <div className="panel-flow">
      <SectionTitle icon={AlertTriangle} title="Risk Assessment" />
      {riskGroups.map((group) => (
        <div className="group-block" key={group}>
          <h2>{groupLabels[group]}</h2>
          <div className="risk-list">
            {riskFactors
              .filter((factor) => factor.group === group)
              .map((factor) => (
                <div className="risk-row" key={factor.id}>
                  <div>
                    <strong>{factor.label}</strong>
                    <small>{factor.guidance}</small>
                  </div>
                  <Slider label="Risk" value={input.risk[factor.id]} onChange={(value) => updateRisk(factor.id, value)} />
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsStep({ input, updateWeight }: { input: DqeInput; updateWeight: (group: RiskGroup, value: number) => void }) {
  const total = Object.values(input.weights).reduce((sum, weight) => sum + weight, 0);

  return (
    <div className="panel-flow">
      <SectionTitle icon={Settings} title="Scoring Settings" />
      <div className={Math.abs(total - 1) <= 0.001 ? "weight-total ok" : "weight-total warn"}>
        <strong>{Math.round(total * 100)}%</strong>
        <span>Risk weights must total 100%.</span>
      </div>
      <div className="settings-grid">
        {riskGroups.map((group) => (
          <div className="setting-row" key={group}>
            <div>
              <strong>{groupLabels[group]}</strong>
              <small>Adjust how much this risk area affects the current assessment.</small>
            </div>
            <Slider label="Weight" value={Math.round(input.weights[group] * 100)} min={0} max={100} onChange={(value) => updateWeight(group, value)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSettings({
  config,
  onChange,
  onApply
}: {
  config: AdminConfig;
  onChange: (config: AdminConfig) => void;
  onApply: () => void;
}) {
  const total = Object.values(config.defaultWeights).reduce((sum, value) => sum + value, 0);
  const updateDefaultWeight = (group: RiskGroup, value: number) => {
    onChange({
      ...config,
      defaultWeights: {
        ...config.defaultWeights,
        [group]: value / 100
      }
    });
  };

  return (
    <div className="panel-flow">
      <SectionTitle icon={Settings} title="Admin Configuration" />
      <div className={Math.abs(total - 1) <= 0.001 ? "weight-total ok" : "weight-total warn"}>
        <strong>{Math.round(total * 100)}%</strong>
        <span>Default weights and decision thresholds for new assessments.</span>
      </div>
      <div className="settings-grid">
        {riskGroups.map((group) => (
          <div className="setting-row" key={group}>
            <div>
              <strong>Default {groupLabels[group]}</strong>
              <small>Used when a new assessment is created.</small>
            </div>
            <Slider label="Default" value={Math.round(config.defaultWeights[group] * 100)} min={0} max={100} onChange={(value) => updateDefaultWeight(group, value)} />
          </div>
        ))}
      </div>
      <div className="admin-grid">
        <label className="field">
          <span>Green Threshold Max</span>
          <input
            type="number"
            step="0.1"
            value={config.thresholds.greenMax}
            onChange={(event) =>
              onChange({ ...config, thresholds: { ...config.thresholds, greenMax: Number(event.target.value) } })
            }
          />
        </label>
        <label className="field">
          <span>Amber Threshold Max</span>
          <input
            type="number"
            step="0.1"
            value={config.thresholds.amberMax}
            onChange={(event) =>
              onChange({ ...config, thresholds: { ...config.thresholds, amberMax: Number(event.target.value) } })
            }
          />
        </label>
      </div>
      <label className="field">
        <span>Recommendation Rules</span>
        <textarea
          value={config.recommendationRules}
          onChange={(event) => onChange({ ...config, recommendationRules: event.target.value })}
          rows={5}
        />
      </label>
      <div className="service-admin-list">
        <strong>Service Catalogue</strong>
        {services.map((service) => (
          <article key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <small>{groupLabels[service.group]}</small>
            </div>
            <p>{service.description}</p>
            <dl>
              <div>
                <dt>Default</dt>
                <dd>{service.defaultRequired ? "In scope" : "Optional"}</dd>
              </div>
              <div>
                <dt>Capability</dt>
                <dd>
                  S{service.defaultCapability.skills} / T{service.defaultCapability.tools} / E{service.defaultCapability.experience}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <button className="primary-action config-action" onClick={onApply} type="button">
        Apply Defaults To Current Assessment
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function getTopRisks(input: DqeInput) {
  return riskFactors
    .map((factor) => ({ ...factor, score: input.risk[factor.id] ?? factor.defaultScore }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function createScenario(input: DqeInput, type: "current" | "reduced" | "partner" | "timeline", thresholds: ScoreThresholds) {
  const scenario = cloneInput(input);
  if (type === "reduced") {
    services
      .filter((service) => service.defaultRequired === false)
      .forEach((service) => {
        scenario.requiredServices[service.id] = false;
      });
    scenario.risk.solutionComplexity = Math.max(1, scenario.risk.solutionComplexity - 1);
    scenario.risk.deadlineFeasibility = Math.max(1, scenario.risk.deadlineFeasibility - 1);
  }
  if (type === "partner") {
    scenario.risk.skillAvailability = Math.max(1, scenario.risk.skillAvailability - 1);
    scenario.risk.teamAvailability = Math.max(1, scenario.risk.teamAvailability - 1);
    Object.keys(scenario.capability).forEach((serviceId) => {
      scenario.capability[serviceId] = {
        skills: Math.min(5, scenario.capability[serviceId].skills + 1),
        tools: scenario.capability[serviceId].tools,
        experience: Math.min(5, scenario.capability[serviceId].experience + 1)
      };
    });
  }
  if (type === "timeline") {
    scenario.risk.deadlineFeasibility = Math.max(1, scenario.risk.deadlineFeasibility - 1);
    scenario.risk.concurrentLoad = Math.max(1, scenario.risk.concurrentLoad - 1);
    scenario.risk.approvalLeadTime = Math.max(1, scenario.risk.approvalLeadTime - 1);
  }
  return calculateDqe(scenario, thresholds);
}

function ScoreStep({
  result,
  input,
  validationErrors,
  completion,
  approvalStatus,
  aiRecommendation,
  aiState,
  thresholds,
  onGenerateAi,
  onExport,
  onGoToOverview
}: {
  result: DqeResult;
  input: DqeInput;
  validationErrors: string[];
  completion: Record<StepId, boolean>;
  approvalStatus: ApprovalStatus;
  aiRecommendation: string;
  aiState: "idle" | "loading" | "ready" | "fallback" | "error";
  thresholds: ScoreThresholds;
  onGenerateAi: () => void;
  onExport: () => void;
  onGoToOverview: () => void;
}) {
  if (validationErrors.length > 0) {
    return (
      <div className="panel-flow">
        <SectionTitle icon={BarChart3} title="Qualification Score" />
        <div className="blocked-score hero-block">
          <div className="hero-icon">
            <AlertTriangle size={28} aria-hidden="true" />
          </div>
          <div>
            <strong>Complete the deal basics first.</strong>
            <p>DQE will unlock the score, PDF export, and approval actions once the required overview fields are complete.</p>
          </div>
          <button className="primary-action" onClick={onGoToOverview} type="button">
            Go to Overview
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="missing-grid">
          {validationErrors.map((error) => (
            <div className="missing-item" key={error}>
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ))}
        </div>
        <div className="readiness-panel">
          <strong>Workflow readiness</strong>
          <div>
            {steps
              .filter((step) => step.id !== "dashboard" && step.id !== "help" && step.id !== "admin")
              .map((step) => {
                const Icon = step.icon;
                return (
                  <span className={completion[step.id] ? "ready-chip done" : "ready-chip"} key={step.id}>
                    <Icon size={14} aria-hidden="true" />
                    {step.label}
                  </span>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  const topRisks = getTopRisks(input);
  const nextAction =
    result.status === "green"
      ? "Assign a Solution Architect and prepare the SOW."
      : result.status === "amber"
        ? `Resolve ${topRisks[0].label.toLowerCase()} before commitment.`
        : "Escalate to leadership before committing commercial scope.";

  return (
    <div className="panel-flow">
      <SectionTitle icon={BarChart3} title="Qualification Score" />
      <section className={`executive-result ${result.status}`}>
        <div>
          <span>Overall Decision</span>
          <strong>{result.statusLabel}</strong>
          <p>{nextAction}</p>
        </div>
        <div className="executive-score">
          <span>{result.weightedRiskScore.toFixed(2)}</span>
          <small>Risk score</small>
        </div>
        <div className="executive-actions">
          <button onClick={onExport} type="button">
            <Download size={16} aria-hidden="true" />
            Export PDF
          </button>
          <small>Approval: {approvalStatus}</small>
        </div>
      </section>
      <div className="exec-grid">
        <div className="exec-card">
          <strong>Top 3 Risks</strong>
          {topRisks.map((risk) => (
            <span key={risk.id}>
              {risk.label}
              <b>{risk.score}/5</b>
            </span>
          ))}
        </div>
        <div className="exec-card">
          <strong>Recommended Next Action</strong>
          <p>{nextAction}</p>
        </div>
      </div>
      <div className="flag-stack">
        {result.flags.map((flag) => (
          <div className={flag.startsWith("Critical") || flag.startsWith("Deadline") || flag.startsWith("Resource") || flag.startsWith("SLA") || flag.startsWith("Low") ? "flag warn" : "flag"} key={flag}>
            {flag}
          </div>
        ))}
      </div>
      <div className="recommendation">
        <strong>Score Explanation</strong>
        {result.explanations.map((explanation) => (
          <p key={explanation}>{explanation}</p>
        ))}
      </div>
      <div className="recommendation">
        <strong>Recommendation</strong>
        <p>{result.recommendation}</p>
      </div>
      <div className="recommendation ai-panel">
        <div className="ai-title">
          <strong>AI Recommendation</strong>
          <button disabled={aiState === "loading"} onClick={onGenerateAi} type="button">
            <Sparkles size={16} aria-hidden="true" />
            {aiState === "loading" ? "Generating" : "Generate"}
          </button>
        </div>
        <p>
          {aiRecommendation ||
            "Generate an AI-assisted presales narrative using deal notes, selected services, risk scores, and capability gaps."}
        </p>
        {aiState === "fallback" && <small>Gemini key is not configured; showing deterministic fallback.</small>}
        {aiState === "error" && <small>AI service unavailable; showing deterministic fallback.</small>}
      </div>
      <ScenarioComparison input={input} thresholds={thresholds} />
    </div>
  );
}

function ScenarioComparison({ input, thresholds }: { input: DqeInput; thresholds: ScoreThresholds }) {
  const scenarios = [
    { id: "current", label: "Current scope", result: createScenario(input, "current", thresholds) },
    { id: "reduced", label: "Reduced scope", result: createScenario(input, "reduced", thresholds) },
    { id: "partner", label: "Partner-supported", result: createScenario(input, "partner", thresholds) },
    { id: "timeline", label: "Extended timeline", result: createScenario(input, "timeline", thresholds) }
  ];

  return (
    <div className="scenario-panel">
      <strong>Scenario Comparison</strong>
      <div>
        {scenarios.map((scenario) => (
          <article key={scenario.id}>
            <span>{scenario.label}</span>
            <b>{scenario.result.weightedRiskScore.toFixed(2)}</b>
            <small>{scenario.result.statusLabel}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function DashboardSummaryPanel({ summaries, onNew }: { summaries: AssessmentSummary[]; onNew: () => void }) {
  const totalDeals = summaries.length;
  const averageScore = totalDeals ? summaries.reduce((sum, summary) => sum + summary.score, 0) / totalDeals : 0;
  const pendingApprovals = summaries.filter((summary) => summary.approvalStatus === "Draft" || summary.approvalStatus === "Submitted").length;
  const highRiskDeals = summaries.filter((summary) => summary.statusLabel.toLowerCase().includes("risk") || summary.score >= 3.5).length;
  const recentDeals = [...summaries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);

  return (
    <aside className="result-panel dashboard-summary">
      <div className="dashboard-summary-hero">
        <span>Portfolio View</span>
        <strong>{totalDeals}</strong>
        <small>{totalDeals === 1 ? "assessment saved" : "assessments saved"}</small>
      </div>
      <div className="metric-grid">
        <Metric label="Avg Score" value={totalDeals ? averageScore.toFixed(2) : "N/A"} />
        <Metric label="Pending" value={String(pendingApprovals)} />
        <Metric label="High Risk" value={String(highRiskDeals)} />
        <Metric label="Reviewed" value={String(summaries.filter((summary) => summary.approvalStatus === "Approved").length)} />
      </div>
      <button className="primary-action summary-action" onClick={onNew} type="button">
        <Plus size={16} aria-hidden="true" />
        New Assessment
      </button>
      <div className="dashboard-recent">
        <strong>Recent Deals</strong>
        {recentDeals.length === 0 ? (
          <span>No assessments yet.</span>
        ) : (
          recentDeals.map((summary) => (
            <div key={summary.id}>
              <span>{summary.title}</span>
              <small>{summary.statusLabel} - {summary.score.toFixed(2)}</small>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function HelpSummaryPanel({ onStart }: { onStart: () => void }) {
  return (
    <aside className="result-panel help-summary">
      <div className="dashboard-summary-hero">
        <span>User Guide</span>
        <strong>DQE</strong>
        <small>Deal Qualification Engine</small>
      </div>
      <div className="help-checklist">
        <strong>Before scoring, confirm:</strong>
        <span>Customer and owner are known</span>
        <span>Deal value and sector are selected</span>
        <span>Timeline is realistic</span>
        <span>Required services are selected</span>
        <span>Key risks are scored honestly</span>
      </div>
      <button className="primary-action summary-action" onClick={onStart} type="button">
        <Plus size={16} aria-hidden="true" />
        New Assessment
      </button>
      <div className="mini-summary">
        <span>Scoring rule</span>
        <strong>1 is low risk, 5 is high risk</strong>
        <small>Use comments and notes when the score needs context.</small>
      </div>
    </aside>
  );
}

function AdminSummaryPanel({ config }: { config: AdminConfig }) {
  const total = Object.values(config.defaultWeights).reduce((sum, value) => sum + value, 0);

  return (
    <aside className="result-panel help-summary">
      <div className="dashboard-summary-hero">
        <span>Admin</span>
        <strong>{services.length}</strong>
        <small>catalogue services</small>
      </div>
      <div className="help-checklist">
        <strong>Configuration affects:</strong>
        <span>Default weights for new assessments</span>
        <span>Green threshold: {config.thresholds.greenMax.toFixed(1)} or below</span>
        <span>Amber threshold: {config.thresholds.amberMax.toFixed(1)} or below</span>
        <span>Service catalogue reference values</span>
      </div>
      <div className={Math.abs(total - 1) <= 0.001 ? "weight-total ok" : "weight-total warn"}>
        <strong>{Math.round(total * 100)}%</strong>
        <span>Default weights total</span>
      </div>
    </aside>
  );
}

function ResultPanel({
  result,
  input,
  validationErrors,
  approvalStatus,
  approver,
  approvalNotes,
  autosaveState,
  onApproverChange,
  onApprovalNotesChange,
  onApprovalAction,
  onSave,
  onExport
}: {
  result: DqeResult;
  input: DqeInput;
  validationErrors: string[];
  approvalStatus: ApprovalStatus;
  approver: string;
  approvalNotes: string;
  autosaveState: AutosaveState;
  onApproverChange: (value: string) => void;
  onApprovalNotesChange: (value: string) => void;
  onApprovalAction: (action: "submit" | "approve" | "reject" | "revision") => void;
  onSave: () => void | Promise<AssessmentRecord | null>;
  onExport: () => void;
}) {
  const isValid = validationErrors.length === 0;

  return (
    <aside className="result-panel">
      <div className={isValid ? `result-status ${result.status}` : "result-status blocked"}>
        <p>{isValid ? "Decision" : "Validation"}</p>
        <strong>{isValid ? result.statusLabel : "Needs Details"}</strong>
        <small>
          Autosave: {autosaveState === "saving" ? "saving..." : autosaveState === "saved" ? "saved" : autosaveState === "error" ? "retry needed" : "waiting"}
        </small>
      </div>
      <div className="metric-grid">
        <Metric label="Score" value={isValid ? result.weightedRiskScore.toFixed(2) : "Pending"} />
        <Metric label="Services" value={String(result.selectedServices)} />
        <Metric label="Capability" value={result.capabilityScore?.toFixed(2) ?? "N/A"} />
        <Metric label="Timeline" value={input.overview.timeline || "Required"} />
      </div>
      {validationErrors.length > 0 && (
        <div className="side-errors">
          {validationErrors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </div>
      )}
      <RiskChart result={result} />
      <div className="breakdown">
        {riskGroups.map((group) => (
          <div key={group}>
            <span>{groupLabels[group]}</span>
            <strong>{result.riskAverages[group].toFixed(2)}</strong>
            <small>{Math.round(input.weights[group] * 100)}%</small>
          </div>
        ))}
      </div>
      <div className="side-actions">
        <button onClick={onSave} type="button">
          <Save size={16} aria-hidden="true" />
          Save
        </button>
        <button disabled={!isValid} onClick={onExport} type="button">
          <Download size={16} aria-hidden="true" />
          PDF
        </button>
      </div>
      <div className="approval-box">
        <div>
          <span>Approval</span>
          <strong>{approvalStatus}</strong>
        </div>
        <label className="field">
          <span>Approver</span>
          <input value={approver} onChange={(event) => onApproverChange(event.target.value)} placeholder="Approver name" />
        </label>
        <label className="field">
          <span>Approval Notes</span>
          <textarea value={approvalNotes} onChange={(event) => onApprovalNotesChange(event.target.value)} rows={3} placeholder="Decision notes" />
        </label>
        <div className="approval-actions">
          <button disabled={!isValid} onClick={() => onApprovalAction("submit")} type="button">
            <Send size={15} aria-hidden="true" />
            Submit
          </button>
          <button disabled={!isValid} onClick={() => onApprovalAction("approve")} type="button">
            <CheckCircle2 size={15} aria-hidden="true" />
            Approve
          </button>
          <button disabled={!isValid} onClick={() => onApprovalAction("revision")} type="button">
            <AlertTriangle size={15} aria-hidden="true" />
            Revise
          </button>
          <button disabled={!isValid} onClick={() => onApprovalAction("reject")} type="button">
            <XCircle size={15} aria-hidden="true" />
            Reject
          </button>
        </div>
      </div>
      <div className="mini-summary">
        <span>{input.overview.customer || "Customer required"}</span>
        <strong>{input.overview.dealValue || "Deal value required"}</strong>
        <small>{input.overview.sector || "Sector required"}</small>
      </div>
    </aside>
  );
}

function RiskChart({ result }: { result: DqeResult }) {
  const chartItems = [
    { label: "Development", value: result.riskAverages.development },
    { label: "Time", value: result.riskAverages.time },
    { label: "Operations", value: result.riskAverages.operations },
    { label: "Capability", value: result.capabilityScore ?? 0, positive: true }
  ];

  return (
    <div className="risk-chart" aria-label="Risk and capability chart">
      {chartItems.map((item) => (
        <div className="chart-row" key={item.label}>
          <span>{item.label}</span>
          <div className={item.positive ? "chart-track positive" : "chart-track"}>
            <i style={{ width: `${Math.min((item.value / 5) * 100, 100)}%` }} />
          </div>
          <strong>{item.value.toFixed(2)}</strong>
        </div>
      ))}
    </div>
  );
}

function ValidationBanner({ errors }: { errors: string[] }) {
  return (
    <div className="validation-banner">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>
        <strong>{errors.length} item{errors.length === 1 ? "" : "s"} needed</strong>
        {errors.join(" ")}
      </span>
    </div>
  );
}

function SaveBanner({ state }: { state: "saving" | "saved" | "error" }) {
  return (
    <div className={`save-banner ${state}`}>
      {state === "saving" ? "Saving assessment..." : state === "saved" ? "Assessment saved." : "Assessment could not be saved."}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="section-title">
      <Icon size={20} aria-hidden="true" />
      <h2>{title}</h2>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className={required && !value.trim() ? "field invalid" : "field"}>
      <span>{label}{required ? " *" : ""}</span>
      <input aria-invalid={required && !value.trim()} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required = false,
  optionLabels = {}
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  optionLabels?: Record<string, string>;
}) {
  return (
    <label className={required && !value.trim() ? "field invalid" : "field"}>
      <span>{label}{required ? " *" : ""}</span>
      <select aria-invalid={required && !value.trim()} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 1,
  max = 5
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="slider">
      <span>
        {label}
        <strong>{max === 100 ? `${value}%` : value}</strong>
      </span>
      <input min={min} max={max} step="1" type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;

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
  getActiveServices,
  groupLabels,
  microsoftPartnerServiceIds,
  RiskGroup,
  riskFactors,
  ScoreThresholds,
  Service,
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
  { id: "score", label: "Decision", icon: Gauge },
  { id: "help", label: "Help", icon: HelpCircle }
] as const;

type StepId = (typeof steps)[number]["id"];
type ApprovalStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Needs Revision";
type AutosaveState = "idle" | "saving" | "saved" | "error";

type AdminConfig = {
  defaultWeights: Record<RiskGroup, number>;
  thresholds: ScoreThresholds;
  recommendationRules: string;
  serviceCatalog: Service[];
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
const recommendedWorkflow = [
  { step: "Dashboard", outcome: "Open an existing deal or start a new qualification." },
  { step: "New Qualification", outcome: "Create a fresh Tender / RFP qualification record." },
  { step: "Overview", outcome: "Capture BD owner, customer, value, deadline, budget, and status." },
  { step: "Service Scope", outcome: "Select the Enfrasys services needed for the opportunity." },
  { step: "Capability", outcome: "Confirm Microsoft partner readiness and delivery experience." },
  { step: "Risk", outcome: "Rate development, time, and operations risk from 1 to 5." },
  { step: "Qualification Decision", outcome: "Review decision, top risks, recommendation, and management review status." },
  { step: "AI Recommendation", outcome: "Generate proposal guidance, mitigation points, and next action." },
  { step: "Save / Export / Management Review", outcome: "Autosave, download the report, or submit for review." }
];

const selectOptions = {
  contactRole: ["CIO/CTO", "IT Director", "IT Manager", "Procurement Officer", "Project Manager", "C-Suite (non-IT)", "End User"],
  opportunityType: ["Tender / RFP", "Direct Proposal", "Renewal / Expansion", "PO / SO Follow-up", "Internal Evaluation"],
  stage: [
    "Tender / RFP Received",
    "DQE Opportunity Intake",
    "Technical + Commercial Qualification",
    "Risk Assessment",
    "Proposal Decision",
    "Proposal Development",
    "Management Approval",
    "PO / Sales Order Reference"
  ],
  dealValue: [
    "Below RM 100K",
    "RM 100K - RM 500K",
    "RM 500K - RM 1M",
    "RM 1M - RM 5M",
    "RM 5M - RM 20M",
    "RM 20M - RM 50M",
    "RM 50M - RM 100M",
    "RM 100M - RM 250M",
    "RM 250M - RM 400M",
    "Above RM 400M"
  ],
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
  procurementType: ["Open Tender", "Direct Negotiation", "Quotation", "Panel Contract", "Framework Agreement", "MyCloud / LAKSANA"],
  yesNoUnknown: ["Unknown", "Yes", "No"],
  partnerDependency: ["Low", "Medium", "High"],
  marginConfidence: ["Low", "Medium", "High"],
  winProbability: ["Low", "Medium", "High"],
  proposalStatus: ["Qualification", "Clarification", "Drafting", "Review", "Submitted", "Awarded / PO", "Closed / No-Go"]
};

const newAssessmentInput: DqeInput = {
  ...defaultInput,
  overview: {
    ...defaultInput.overview,
    customer: "",
    opportunity: "",
    owner: "",
    bdOwner: "",
    solutionOwner: "",
    contactName: "",
    opportunityType: "Tender / RFP",
    dealValue: "",
    sector: "",
    timeline: "",
    deadlineDate: "",
    budgetConfirmed: "Unknown",
    decisionMakerIdentified: "Unknown",
    fundingSourceKnown: "Unknown",
    partnerDependency: "Medium",
    marginConfidence: "Medium",
    winProbability: "Medium",
    proposalStatus: "Qualification",
    poSoReference: "",
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
    "Green: proceed with standard governance.\nAmber: confirm capacity, resolve flagged risks, add contingency.\nRed: escalate to leadership before committing.",
  serviceCatalog: services.map((service) => ({
    ...service,
    strategic: service.strategic ?? service.defaultRequired,
    disabled: service.disabled ?? false
  }))
};

const normalizeAdminConfig = (config: Partial<AdminConfig> = {}): AdminConfig => ({
  ...defaultAdminConfig,
  ...config,
  defaultWeights: { ...defaultAdminConfig.defaultWeights, ...config.defaultWeights },
  thresholds: { ...defaultAdminConfig.thresholds, ...config.thresholds },
  serviceCatalog: (config.serviceCatalog ?? defaultAdminConfig.serviceCatalog).map((service) => ({
    ...service,
    strategic: Boolean(service.strategic),
    disabled: Boolean(service.disabled)
  }))
});

const loadAdminConfig = () => {
  const stored = localStorage.getItem("dqe-admin-config");
  return stored ? normalizeAdminConfig(JSON.parse(stored) as AdminConfig) : defaultAdminConfig;
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

function getCompletion(input: DqeInput, serviceCatalog: Service[] = services) {
  const selectedServices = getActiveServices(serviceCatalog).filter((service) => input.requiredServices[service.id]);
  const weightTotal = Object.values(input.weights).reduce((sum, weight) => sum + weight, 0);
  const overviewComplete = requiredOverviewFields.every((field) => input.overview[field].trim());
  const hasSelectedServices = selectedServices.length > 0;

  return {
    dashboard: true,
    overview: overviewComplete,
    requirements: overviewComplete && hasSelectedServices,
    capability: overviewComplete && hasSelectedServices && selectedServices.every((service) => {
      const score = input.capability[service.id];
      return score && score.skills >= 1 && score.tools >= 1 && score.experience >= 1;
    }),
    risk: overviewComplete && riskFactors.every((factor) => input.risk[factor.id] >= 1 && input.risk[factor.id] <= 5),
    settings: overviewComplete && Math.abs(weightTotal - 1) <= 0.001,
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
  const serviceCatalog = adminConfig.serviceCatalog;
  const activeServices = useMemo(() => getActiveServices(serviceCatalog), [serviceCatalog]);

  const validationErrors = useMemo(() => validateInput(input), [input]);
  const isValid = validationErrors.length === 0;
  const localResult = useMemo(() => calculateDqe(input, adminConfig.thresholds, serviceCatalog), [input, adminConfig.thresholds, serviceCatalog]);
  const result = apiResult ?? localResult;
  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  const completion = useMemo(() => getCompletion(input, serviceCatalog), [input, serviceCatalog]);
  const pageTitle =
    activeStep === "dashboard"
      ? "Tender / RFP qualifications"
      : activeStep === "help"
        ? "User help"
        : activeStep === "admin"
          ? "Admin configuration"
          : activeStep === "settings"
            ? "Scoring settings"
            : activeStep === "requirements"
              ? "Service scope"
              : activeStep === "score"
                ? "Qualification decision"
              : input.overview.opportunity || "New qualification";

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
      setAdminConfig(normalizeAdminConfig(config));
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
      weights: adminConfig.defaultWeights,
      requiredServices: {
        ...current.requiredServices,
        ...Object.fromEntries(getActiveServices(adminConfig.serviceCatalog).map((service) => [service.id, service.defaultRequired]))
      },
      capability: {
        ...Object.fromEntries(getActiveServices(adminConfig.serviceCatalog).map((service) => [service.id, service.defaultCapability])),
        ...current.capability
      }
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
    const title = input.overview.opportunity || "DQE Qualification";
    const fileName = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "dqe-assessment"}.pdf`;

    doc.setFillColor(16, 35, 28);
    doc.rect(0, 0, 210, 34, "F");
    doc.setFillColor(240, 201, 95);
    doc.roundedRect(14, 8, 14, 14, 2, 2, "F");
    doc.setTextColor(16, 35, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("E", 19, 17);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Enfrasys", 34, 14);
    doc.setFontSize(11);
    doc.text("Tender / RFP Qualification Report", 34, 24);
    doc.setFontSize(9);
    doc.setTextColor(204, 223, 215);
    doc.text("DQE v0.1 | Management review evidence", 150, 14);
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
    doc.text(`Management Review: ${approvalStatus}`, 14, 66);
    doc.text(`Version: DQE 0.1`, 14, 74);
    doc.text(`Sector: ${input.overview.sector}`, 112, 42);
    doc.text(`Deal Value: ${input.overview.dealValue}`, 112, 50);
    doc.text(`Timeline: ${input.overview.timeline}`, 112, 58);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 112, 66);
    doc.text(`BD Stage: ${input.overview.stage}`, 112, 74);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`Decision: ${result.statusLabel}`, 14, 84);
    doc.text(`Qualification Risk: ${result.weightedRiskScore.toFixed(2)}`, 14, 94);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Selected Services: ${result.selectedServices}`, 14, 104);
    doc.text(`Capability Score: ${result.capabilityScore?.toFixed(2) ?? "N/A"}`, 14, 112);
    doc.text(`Commercial Risk: ${result.commercialRiskScore?.toFixed(2) ?? "N/A"}`, 112, 112);

    doc.setFont("helvetica", "bold");
    doc.text("Risk Breakdown", 14, 128);
    doc.setFont("helvetica", "normal");
    const chartRows = [
      ...riskGroups.map((group) => ({ label: groupLabels[group], value: result.riskAverages[group], weight: `${Math.round(input.weights[group] * 100)}%` })),
      { label: "Commercial Risk", value: result.commercialRiskScore ?? 0, weight: "15%" },
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
    doc.text("Decision Explanation", 14, 186);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(result.explanations.map((explanation) => `- ${explanation}`).join("\n"), 180), 14, 196);

    doc.setFont("helvetica", "bold");
    doc.text("Recommendation", 14, 230);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(result.recommendation, 180), 14, 240);

    doc.addPage();
    const proposalSupport = buildProposalSupport(input, result, activeServices);
    doc.setFont("helvetica", "bold");
    doc.text("Risk Flags", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(result.flags.map((flag) => `- ${flag}`).join("\n"), 180), 14, 28);
    doc.setFont("helvetica", "bold");
    doc.text("BD & Commercial Qualification", 14, 82);
    doc.setFont("helvetica", "normal");
    doc.text(`Opportunity Type: ${input.overview.opportunityType || "Not specified"}`, 14, 94);
    doc.text(`BD Owner: ${input.overview.bdOwner || input.overview.owner || "Not assigned"}`, 14, 102);
    doc.text(`Solution Owner: ${input.overview.solutionOwner || "Not assigned"}`, 14, 110);
    doc.text(`Submission Deadline: ${input.overview.deadlineDate || "Not set"}`, 14, 118);
    doc.text(`Budget Confirmed: ${input.overview.budgetConfirmed || "Unknown"}`, 112, 94);
    doc.text(`Decision Maker: ${input.overview.decisionMakerIdentified || "Unknown"}`, 112, 102);
    doc.text(`Partner Dependency: ${input.overview.partnerDependency || "Unknown"}`, 112, 110);
    doc.text(`PO/SO Reference: ${input.overview.poSoReference || "Pending"}`, 112, 118);
    doc.setFont("helvetica", "bold");
    doc.text("Management Review & Sign-off", 14, 146);
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${approvalStatus}`, 14, 158);
    doc.text(`Approver: ${approver || "Pending"}`, 14, 166);
    doc.text(doc.splitTextToSize(`Notes: ${approvalNotes || "None"}`, 180), 14, 174);
    doc.line(14, 190, 90, 190);
    doc.line(114, 190, 190, 190);
    doc.text("Solution Architect", 14, 198);
    doc.text("Management Approver", 114, 198);

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Proposal Assistant", 14, 18);
    doc.setFontSize(11);
    let proposalY = 30;
    ([
      ["Clarification Questions", proposalSupport.clarifications],
      ["Proposal Assumptions", proposalSupport.assumptions],
      ["Proposal Exclusions", proposalSupport.exclusions],
      ["SOW Points", proposalSupport.sowPoints],
      ["Risk Mitigation Actions", proposalSupport.mitigations]
    ] as const).forEach(([section, items]) => {
      doc.setFont("helvetica", "bold");
      doc.text(section, 14, proposalY);
      proposalY += 8;
      doc.setFont("helvetica", "normal");
      const text = doc.splitTextToSize(items.map((item) => `- ${item}`).join("\n"), 180);
      doc.text(text, 14, proposalY);
      proposalY += text.length * 5 + 10;
      if (proposalY > 250) {
        doc.addPage();
        proposalY = 20;
      }
    });

    if (aiRecommendation.trim()) {
      if (proposalY > 210) {
        doc.addPage();
        proposalY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text("AI Recommendation", 14, proposalY);
      proposalY += 8;
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(normalizeAiRecommendation(aiRecommendation), 180), 14, proposalY);
    }
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
    const service = serviceCatalog.find((item) => item.id === serviceId);
    setInput((current) => ({
      ...current,
      requiredServices: { ...current.requiredServices, [serviceId]: required },
      capability: service && !current.capability[serviceId]
        ? { ...current.capability, [serviceId]: service.defaultCapability }
        : current.capability
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
          <img className="brand-logo" src="/enfrasys-logo.svg" alt="Enfrasys" />
          <div>
            <p>Deal Qualification</p>
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
              New Qualification
            </button>
            <button className="icon-action" onClick={() => void saveAssessment()} title="Save qualification" type="button">
              <Save size={18} aria-hidden="true" />
              <span>Save</span>
            </button>
            <button className="icon-action" disabled={!isValid} onClick={exportPdf} title="Download report" type="button">
              <Download size={18} aria-hidden="true" />
              <span>PDF</span>
            </button>
            <button className="icon-action" onClick={() => setInput(cloneInput(defaultInput))} title="Load sample qualification" type="button">
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
            {activeStep === "requirements" && <RequirementsStep input={input} serviceCatalog={activeServices} updateRequired={updateRequired} />}
            {activeStep === "capability" && <CapabilityStep input={input} serviceCatalog={activeServices} updateCapability={updateCapability} />}
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
                serviceCatalog={activeServices}
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
    <section className="saved-list" aria-label="Saved qualifications">
      <button className="saved-title saved-title-button" onClick={onDashboard} type="button">
        <FolderOpen size={16} aria-hidden="true" />
        <span>Saved</span>
      </button>
      {summaries.length === 0 ? (
        <p>No saved qualifications yet.</p>
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
      <SectionTitle icon={HelpCircle} title="How to Fill a Tender / RFP Qualification" />
      <section className="help-intro">
        <div>
          <strong>Use DQE before committing presales effort.</strong>
          <p>
            Fill the qualification with the best information available at tender/RFP stage. The goal is not perfection; the goal is a consistent view of deal fit, risk, capability, and next action.
          </p>
          <p>
            The live Azure dashboard includes two demo qualifications: Prolintas TCS Cloud Modernisation POC and MCMC Dynamics 365 Smart City Assessment.
          </p>
        </div>
        <button className="primary-action" onClick={onStart} type="button">
          <Plus size={16} aria-hidden="true" />
          Start New Qualification
        </button>
      </section>

      <section className="workflow-guide" aria-label="Recommended DQE workflow">
        <div className="workflow-guide-header">
          <span>Recommended workflow</span>
          <strong>Dashboard to management review, in one guided path</strong>
        </div>
        <div className="workflow-steps">
          {recommendedWorkflow.map((item, index) => (
            <article key={item.step}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <strong>{item.step}</strong>
                <p>{item.outcome}</p>
              </div>
            </article>
          ))}
        </div>
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
            <li>Platform: Microsoft services, accelerators, templates, and delivery tooling.</li>
            <li>Experience: similar delivery history or references.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>4</span>
          <strong>Risk</strong>
          <p>Score risk from 1 to 5. Lower is safer, higher needs mitigation or management review before commitment.</p>
          <ul>
            <li>1: low risk, normal delivery confidence.</li>
            <li>3: moderate risk, needs attention.</li>
            <li>5: high risk, escalation or scope change likely needed.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>5</span>
          <strong>Settings</strong>
          <p>Use weights only when the qualification needs a different emphasis. For most users, keep the default weights.</p>
          <ul>
            <li>Development: solution complexity and build risk.</li>
            <li>Time: deadline and approval timing risk.</li>
            <li>Operations: support, SLA, and run-state risk.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>6</span>
          <strong>Qualification Decision</strong>
          <p>Review the final decision, top risks, recommendation, management review status, and export the PDF when ready.</p>
          <ul>
            <li>Green: proceed with normal governance.</li>
            <li>Amber: proceed with mitigation actions.</li>
            <li>Red: escalate before committing scope or timeline.</li>
            <li>Use Generate to create a Gemini-assisted executive recommendation when the API key is configured.</li>
          </ul>
        </article>

        <article className="help-card">
          <span>7</span>
          <strong>Management Review</strong>
          <p>Use review actions after the qualification has enough detail for management or solution review.</p>
          <ul>
            <li>Submit: send the qualification for management or solution review.</li>
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
        <strong>What good looks like</strong>
        <p>
          A completed qualification has enough BD and technical context to justify the recommendation, explain the top risks, support proposal preparation, and provide a management review or PDF evidence trail.
        </p>
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
      <SectionTitle icon={LayoutDashboard} title="Qualification History" />
      <div className="dashboard-filters">
        <label className="field search-field">
          <span>Search</span>
          <div>
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, owner, status..." />
          </div>
        </label>
        <SelectField label="Owner" value={ownerFilter} options={["All", ...owners]} onChange={setOwnerFilter} />
        <SelectField label="Management Review" value={statusFilter} options={approvalStatuses} onChange={setStatusFilter} />
        <SelectField
          label="Sort"
          value={sortBy}
          options={["updated", "scoreHigh", "scoreLow", "status"]}
          optionLabels={{
            updated: "Last updated",
            scoreHigh: "Risk high to low",
            scoreLow: "Risk low to high",
            status: "Status"
          }}
          onChange={(value) => setSortBy(value as typeof sortBy)}
        />
      </div>
      <div className="history-table">
        <div className="history-head">
          <span>Deal</span>
          <span>Risk Score</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Review</span>
          <span>Last Updated</span>
          <span>Action</span>
        </div>
        {filteredSummaries.length === 0 ? (
          <div className="history-empty">
            <strong>No matching qualifications</strong>
            <span>Create a Tender / RFP qualification or adjust the filters to find saved work.</span>
            <button className="primary-action" onClick={onNew} type="button">
              <Plus size={16} aria-hidden="true" />
              New Qualification
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
      <BdProcessAlignment activeStage={input.overview.stage} onStageChange={(stage) => updateOverview("stage", stage)} />
      <div className="form-grid">
        <TextField required label="Customer / Organisation" value={input.overview.customer} onChange={(value) => updateOverview("customer", value)} />
        <TextField label="Opportunity / Project" value={input.overview.opportunity} onChange={(value) => updateOverview("opportunity", value)} />
        <TextField required label="Owner" value={input.overview.owner} onChange={(value) => updateOverview("owner", value)} />
        <TextField label="BD Owner" value={input.overview.bdOwner} onChange={(value) => updateOverview("bdOwner", value)} />
        <TextField label="Solution Owner" value={input.overview.solutionOwner} onChange={(value) => updateOverview("solutionOwner", value)} />
        <TextField label="Primary Contact" value={input.overview.contactName} onChange={(value) => updateOverview("contactName", value)} />
        <SelectField label="Contact Role" value={input.overview.contactRole} options={selectOptions.contactRole} onChange={(value) => updateOverview("contactRole", value)} />
        <SelectField label="Opportunity Type" value={input.overview.opportunityType} options={selectOptions.opportunityType} onChange={(value) => updateOverview("opportunityType", value)} />
        <SelectField label="BD Stage" value={input.overview.stage} options={selectOptions.stage} onChange={(value) => updateOverview("stage", value)} />
        <SelectField required label="Deal Value" value={input.overview.dealValue} options={selectOptions.dealValue} onChange={(value) => updateOverview("dealValue", value)} />
        <SelectField required label="Sector" value={input.overview.sector} options={selectOptions.sector} onChange={(value) => updateOverview("sector", value)} />
        <SelectField required label="Timeline" value={input.overview.timeline} options={selectOptions.timeline} onChange={(value) => updateOverview("timeline", value)} />
        <SelectField label="Procurement Type" value={input.overview.procurementType} options={selectOptions.procurementType} onChange={(value) => updateOverview("procurementType", value)} />
        <TextField label="Submission Deadline" type="date" value={input.overview.deadlineDate} onChange={(value) => updateOverview("deadlineDate", value)} />
        <SelectField label="Budget Confirmed" value={input.overview.budgetConfirmed} options={selectOptions.yesNoUnknown} onChange={(value) => updateOverview("budgetConfirmed", value)} />
        <SelectField label="Decision Maker Identified" value={input.overview.decisionMakerIdentified} options={selectOptions.yesNoUnknown} onChange={(value) => updateOverview("decisionMakerIdentified", value)} />
        <SelectField label="Funding Source Known" value={input.overview.fundingSourceKnown} options={selectOptions.yesNoUnknown} onChange={(value) => updateOverview("fundingSourceKnown", value)} />
        <SelectField label="Partner Dependency" value={input.overview.partnerDependency} options={selectOptions.partnerDependency} onChange={(value) => updateOverview("partnerDependency", value)} />
        <SelectField label="Margin Confidence" value={input.overview.marginConfidence} options={selectOptions.marginConfidence} onChange={(value) => updateOverview("marginConfidence", value)} />
        <SelectField label="Win Probability" value={input.overview.winProbability} options={selectOptions.winProbability} onChange={(value) => updateOverview("winProbability", value)} />
        <SelectField label="Proposal Status" value={input.overview.proposalStatus} options={selectOptions.proposalStatus} onChange={(value) => updateOverview("proposalStatus", value)} />
        <TextField label="PO/SO Reference" value={input.overview.poSoReference} onChange={(value) => updateOverview("poSoReference", value)} />
      </div>
      <label className="field wide">
        <span>Requirements, Assumptions, Exclusions & Clarifications</span>
        <textarea value={input.overview.notes} onChange={(event) => updateOverview("notes", event.target.value)} rows={5} />
      </label>
    </div>
  );
}

function BdProcessAlignment({ activeStage, onStageChange }: { activeStage: string; onStageChange: (stage: string) => void }) {
  const stages = [
    "Tender / RFP Received",
    "DQE Opportunity Intake",
    "Technical + Commercial Qualification",
    "Risk Assessment",
    "Proposal Decision",
    "Proposal Development",
    "Management Approval",
    "PO / Sales Order Reference"
  ];
  const normalizeStage = (stage: string) => {
    if (stage === "Initial Qualification") return "DQE Opportunity Intake";
    if (stage === "Technical Review") return "Technical + Commercial Qualification";
    return stage;
  };
  const normalizedActiveStage = normalizeStage(activeStage);
  const activeIndex = Math.max(
    0,
    stages.findIndex((stage) => normalizedActiveStage === stage)
  );

  return (
    <section className="bd-flow" aria-label="BD process alignment">
      <div>
        <strong>BD Process Alignment</strong>
        <p>DQE acts as the qualification checkpoint between tender/RFP intake, technical/commercial review, proposal readiness, management review, and PO/SO handover.</p>
      </div>
      <div className="bd-flow-steps">
        {stages.map((stage, index) => (
          <button
            type="button"
            aria-pressed={normalizedActiveStage === stage}
            className={index <= activeIndex ? "active" : ""}
            key={stage}
            onClick={() => onStageChange(stage)}
          >
            {stage}
          </button>
        ))}
      </div>
    </section>
  );
}

function RequirementsStep({
  input,
  serviceCatalog,
  updateRequired
}: {
  input: DqeInput;
  serviceCatalog: Service[];
  updateRequired: (serviceId: string, required: boolean) => void;
}) {
  return (
    <div className="panel-flow">
      <SectionTitle icon={ListChecks} title="Service Scope" />
      {serviceGroups.map((group) => (
        <div className="group-block" key={group}>
          <h2>{groupLabels[group]}</h2>
          <div className="service-list">
            {serviceCatalog
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
  serviceCatalog,
  updateCapability
}: {
  input: DqeInput;
  serviceCatalog: Service[];
  updateCapability: (serviceId: string, key: keyof DqeInput["capability"][string], value: number) => void;
}) {
  const selectedServices = serviceCatalog.filter((service) => input.requiredServices[service.id]);
  const microsoftAlignedCount = selectedServices.filter((service) => microsoftPartnerServiceIds.has(service.id)).length;
  const capabilityAverage =
    selectedServices.length === 0
      ? null
      : selectedServices.reduce((sum, service) => {
          const score = input.capability[service.id] ?? service.defaultCapability;
          return sum + (score.skills + score.tools + score.experience) / 3;
        }, 0) / selectedServices.length;

  return (
    <div className="panel-flow">
      <SectionTitle icon={SlidersHorizontal} title="Microsoft Capability Match" />
      <section className="capability-hero">
        <div>
          <strong>Start from Enfrasys Microsoft partner strengths, then adjust for the real deal.</strong>
          <p>
            Azure, Microsoft 365, Defender, Fabric, Power Platform, data, AI, and managed services now use stronger default readiness because these are core Microsoft-aligned offerings. Lower the sliders only when this opportunity has unusual scope, delivery constraints, or specialist dependency.
          </p>
        </div>
        <div className="capability-metrics" aria-label="Capability summary">
          <span>
            <b>{selectedServices.length}</b>
            selected services
          </span>
          <span>
            <b>{microsoftAlignedCount}</b>
            Microsoft-aligned
          </span>
          <span>
            <b>{capabilityAverage === null ? "N/A" : capabilityAverage.toFixed(2)}</b>
            average readiness
          </span>
        </div>
      </section>
      <div className="slider-table">
        {selectedServices.map((service) => {
          const score = input.capability[service.id];
          const isMicrosoftAligned = microsoftPartnerServiceIds.has(service.id);
          return (
            <div className={isMicrosoftAligned ? "score-row partner-ready" : "score-row"} key={service.id}>
              <div>
                <div className="capability-title">
                  <strong>{service.name}</strong>
                  {isMicrosoftAligned && <span>Microsoft partner baseline</span>}
                </div>
                <small>{service.description}</small>
              </div>
              <Slider label="Skills" value={score.skills} onChange={(value) => updateCapability(service.id, "skills", value)} />
              <Slider label="Platform" value={score.tools} onChange={(value) => updateCapability(service.id, "tools", value)} />
              <Slider label="Experience" value={score.experience} onChange={(value) => updateCapability(service.id, "experience", value)} />
            </div>
          );
        })}
        {selectedServices.length === 0 && (
          <div className="empty-capability">
            <strong>No services selected yet.</strong>
            <span>Go to Service Scope and choose the Microsoft or Enfrasys offerings required for this opportunity.</span>
          </div>
        )}
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
              <small>Adjust how much this risk area affects the current qualification.</small>
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
  const updateService = (id: string, patch: Partial<Service>) => {
    onChange({
      ...config,
      serviceCatalog: config.serviceCatalog.map((service) => service.id === id ? { ...service, ...patch } : service)
    });
  };
  const updateServiceCapability = (id: string, key: keyof Service["defaultCapability"], value: number) => {
    onChange({
      ...config,
      serviceCatalog: config.serviceCatalog.map((service) =>
        service.id === id
          ? { ...service, defaultCapability: { ...service.defaultCapability, [key]: value } }
          : service
      )
    });
  };
  const addService = () => {
    const id = `customService${Date.now()}`;
    onChange({
      ...config,
      serviceCatalog: [
        ...config.serviceCatalog,
        {
          id,
          group: "managedAdvisory",
          name: "New Enfrasys Service",
          description: "Describe the service scope, dependencies, and delivery model.",
          defaultRequired: false,
          strategic: false,
          disabled: false,
          defaultCapability: { skills: 3, tools: 3, experience: 3 }
        }
      ]
    });
  };
  const activeCount = config.serviceCatalog.filter((service) => !service.disabled).length;

  return (
    <div className="panel-flow">
      <SectionTitle icon={Settings} title="Admin Configuration" />
      <div className={Math.abs(total - 1) <= 0.001 ? "weight-total ok" : "weight-total warn"}>
        <strong>{Math.round(total * 100)}%</strong>
        <span>Default weights and decision thresholds for new qualifications.</span>
      </div>
      <div className="settings-grid">
        {riskGroups.map((group) => (
          <div className="setting-row" key={group}>
            <div>
              <strong>Default {groupLabels[group]}</strong>
              <small>Used when a new qualification is created.</small>
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
        <div className="catalogue-heading">
          <div>
            <strong>Service Catalogue</strong>
            <span>{activeCount} active services, {config.serviceCatalog.length - activeCount} disabled. Stored in the backend admin configuration.</span>
          </div>
          <button className="secondary-action" onClick={addService} type="button">
            <Plus size={16} aria-hidden="true" />
            Add Service
          </button>
        </div>
        {serviceGroups.map((group) => (
          <section className="catalogue-group" key={group}>
            <div className="catalogue-group-heading">
              <strong>{groupLabels[group]}</strong>
              <span>{config.serviceCatalog.filter((service) => service.group === group && !service.disabled).length} active services</span>
            </div>
            <div className="catalogue-services">
              {config.serviceCatalog
                .filter((service) => service.group === group)
                .map((service) => (
                  <article className={service.disabled ? "catalogue-disabled" : ""} key={service.id}>
                    <div className="catalogue-service-title">
                      <strong>{service.name}</strong>
                      <div className="catalogue-pills">
                        {service.strategic && <span className="scope-pill strategic">Strategic</span>}
                        <span className={service.defaultRequired ? "scope-pill required" : "scope-pill"}>{service.defaultRequired ? "Default in scope" : "Optional"}</span>
                        {service.disabled && <span className="scope-pill disabled">Disabled</span>}
                      </div>
                    </div>
                    <div className="catalogue-edit-grid">
                      <label className="field">
                        <span>Service Name</span>
                        <input value={service.name} onChange={(event) => updateService(service.id, { name: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>Portfolio</span>
                        <select value={service.group} onChange={(event) => updateService(service.id, { group: event.target.value as ServiceGroup })}>
                          {serviceGroups.map((option) => <option key={option} value={option}>{groupLabels[option]}</option>)}
                        </select>
                      </label>
                      <label className="field wide">
                        <span>Description</span>
                        <textarea value={service.description} rows={2} onChange={(event) => updateService(service.id, { description: event.target.value })} />
                      </label>
                    </div>
                    <div className="catalogue-switches">
                      <label><input checked={service.defaultRequired} type="checkbox" onChange={(event) => updateService(service.id, { defaultRequired: event.target.checked })} /> Default in scope</label>
                      <label><input checked={Boolean(service.strategic)} type="checkbox" onChange={(event) => updateService(service.id, { strategic: event.target.checked })} /> Strategic service</label>
                      <label><input checked={Boolean(service.disabled)} type="checkbox" onChange={(event) => updateService(service.id, { disabled: event.target.checked })} /> Disabled</label>
                    </div>
                    <dl>
                      <div>
                        <dt>Skills</dt>
                        <dd><input max={5} min={1} type="number" value={service.defaultCapability.skills} onChange={(event) => updateServiceCapability(service.id, "skills", Number(event.target.value))} /></dd>
                      </div>
                      <div>
                        <dt>Platform</dt>
                        <dd><input max={5} min={1} type="number" value={service.defaultCapability.tools} onChange={(event) => updateServiceCapability(service.id, "tools", Number(event.target.value))} /></dd>
                      </div>
                      <div>
                        <dt>Experience</dt>
                        <dd><input max={5} min={1} type="number" value={service.defaultCapability.experience} onChange={(event) => updateServiceCapability(service.id, "experience", Number(event.target.value))} /></dd>
                      </div>
                    </dl>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
      <button className="primary-action config-action" onClick={onApply} type="button">
        Apply Defaults To Current Qualification
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

function buildProposalSupport(input: DqeInput, result: DqeResult, serviceCatalog: Service[] = services) {
  const selected = serviceCatalog.filter((service) => input.requiredServices[service.id]);
  const topRisks = getTopRisks(input);
  const scopeNames = selected.map((service) => service.name).slice(0, 5);

  return {
    clarifications: [
      input.overview.budgetConfirmed !== "Yes" ? "Confirm budget availability, funding source, and approval owner." : "Confirm final commercial approval route and procurement timeline.",
      input.overview.decisionMakerIdentified !== "Yes" ? "Identify the business decision maker and technical approver." : "Confirm decision maker expectations for success criteria.",
      `Validate scope boundaries for ${scopeNames.join(", ") || "selected services"}.`,
      topRisks[0] ? `Clarify mitigation plan for ${topRisks[0].label.toLowerCase()}.` : "Confirm there are no hidden delivery constraints."
    ],
    assumptions: [
      "Customer will provide timely access to required technical, procurement, and business stakeholders.",
      "Existing vendor dependencies and third-party responsibilities will be documented before final proposal submission.",
      "Commercial pricing remains subject to confirmed scope, timeline, support model, and partner inputs."
    ],
    exclusions: [
      "Unconfirmed custom development, integrations, or vendor remediation outside the agreed scope.",
      "Production cutover, SLA penalties, or managed operations commitments not explicitly approved in the SOW.",
      "Licensing, third-party hardware, or external vendor costs unless separately stated."
    ],
    sowPoints: [
      `Qualification decision: ${result.statusLabel}.`,
      `Primary services in scope: ${scopeNames.join(", ") || "to be confirmed"}.`,
      `Risk score: ${result.weightedRiskScore.toFixed(2)}; commercial risk: ${result.commercialRiskScore?.toFixed(2) ?? "N/A"}.`,
      "Include governance cadence, acceptance criteria, escalation path, and handover requirements."
    ],
    mitigations: [
      result.status === "red" ? "Escalate to leadership before committing commercial scope." : "Proceed through normal governance with documented risk owners.",
      input.overview.partnerDependency === "High" ? "Lock partner scope, SLA, and responsibility matrix before pricing." : "Keep partner and vendor assumptions visible in the proposal.",
      "Add contingency for high-scoring technical, timeline, operations, or commercial risks."
    ]
  };
}

function createScenario(input: DqeInput, type: "current" | "reduced" | "partner" | "timeline", thresholds: ScoreThresholds, serviceCatalog: Service[] = services) {
  const scenario = cloneInput(input);
  if (type === "reduced") {
    serviceCatalog
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
  return calculateDqe(scenario, thresholds, serviceCatalog);
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
  serviceCatalog,
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
  serviceCatalog: Service[];
  onGenerateAi: () => void;
  onExport: () => void;
  onGoToOverview: () => void;
}) {
  if (validationErrors.length > 0) {
    return (
      <div className="panel-flow">
        <SectionTitle icon={BarChart3} title="Qualification Decision" />
        <div className="blocked-score hero-block">
          <div className="hero-icon">
            <AlertTriangle size={28} aria-hidden="true" />
          </div>
          <div>
            <strong>Complete the deal basics first.</strong>
            <p>DQE will unlock the decision, PDF export, and management review actions once the required overview fields are complete.</p>
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
          <p>Start with Overview. The remaining workflow stays locked until the required deal basics are complete.</p>
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
  const proposalSupport = buildProposalSupport(input, result, serviceCatalog);

  return (
    <div className="panel-flow">
      <SectionTitle icon={BarChart3} title="Qualification Decision" />
      <section className={`executive-result ${result.status}`}>
        <div>
          <span>Overall Decision</span>
          <strong>{result.statusLabel}</strong>
          <p>{nextAction}</p>
        </div>
        <div className="executive-score">
          <span>{result.weightedRiskScore.toFixed(2)}</span>
          <small>Qualification risk</small>
        </div>
        <div className="executive-actions">
          <button onClick={onExport} type="button">
            <Download size={16} aria-hidden="true" />
            Export PDF
          </button>
          <small>Management review: {approvalStatus}</small>
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
        <strong>Decision Explanation</strong>
        {result.explanations.map((explanation) => (
          <p key={explanation}>{explanation}</p>
        ))}
      </div>
      <div className="recommendation">
        <strong>Recommendation</strong>
        <p>{result.recommendation}</p>
      </div>
      <ProposalSupportPanel support={proposalSupport} />
      <div className="recommendation ai-panel">
        <div className="ai-title">
          <strong>AI Recommendation</strong>
          <button disabled={aiState === "loading"} onClick={onGenerateAi} type="button">
            <Sparkles size={16} aria-hidden="true" />
            {aiState === "loading" ? "Generating" : "Generate"}
          </button>
        </div>
        <AiRecommendationOutput
          text={
            aiRecommendation ||
            "Generate an AI-assisted presales narrative using deal notes, selected services, risk scores, and capability gaps."
          }
        />
        {aiState === "fallback" && <small>Gemini key is not configured; showing deterministic fallback.</small>}
        {aiState === "error" && <small>AI service unavailable; showing deterministic fallback.</small>}
      </div>
      <ScenarioComparison input={input} thresholds={thresholds} serviceCatalog={serviceCatalog} />
    </div>
  );
}

function ProposalSupportPanel({ support }: { support: ReturnType<typeof buildProposalSupport> }) {
  const sections = [
    ["Clarification Questions", support.clarifications],
    ["Proposal Assumptions", support.assumptions],
    ["Proposal Exclusions", support.exclusions],
    ["SOW Points", support.sowPoints],
    ["Risk Mitigation Actions", support.mitigations]
  ] as const;

  return (
    <div className="proposal-support">
      <strong>Proposal Assistant</strong>
      <div>
        {sections.map(([title, items]) => (
          <article key={title}>
            <h3>{title}</h3>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

function normalizeAiRecommendation(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\s+--\s+-\s+/g, "\n- ")
    .replace(/\s+(#{2,4}\s+)/g, "\n$1")
    .replace(/\s+(\d+\.\s+)/g, "\n$1")
    .replace(/\s+-\s+/g, "\n- ")
    .trim();
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part.replace(/\*/g, "")}</span>;
  });
}

function AiRecommendationOutput({ text }: { text: string }) {
  const lines = normalizeAiRecommendation(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="ai-output">
      {lines.map((line, index) => {
        const heading = line.match(/^#{2,4}\s+(.*)$/);
        if (heading) {
          return (
            <h3 className="ai-heading" key={`${line}-${index}`}>
              {renderInlineMarkdown(heading[1])}
            </h3>
          );
        }

        const numbered = line.match(/^(\d+)\.\s+(.*)$/);
        if (numbered) {
          return (
            <div className="ai-numbered" key={`${line}-${index}`}>
              <b>{numbered[1]}</b>
              <p>{renderInlineMarkdown(numbered[2])}</p>
            </div>
          );
        }

        const bullet = line.match(/^[-•]\s+(.*)$/);
        if (bullet) {
          return (
            <div className="ai-bullet" key={`${line}-${index}`}>
              <span aria-hidden="true" />
              <p>{renderInlineMarkdown(bullet[1])}</p>
            </div>
          );
        }

        return <p key={`${line}-${index}`}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function ScenarioComparison({ input, thresholds, serviceCatalog }: { input: DqeInput; thresholds: ScoreThresholds; serviceCatalog: Service[] }) {
  const scenarios = [
    { id: "current", label: "Current scope", result: createScenario(input, "current", thresholds, serviceCatalog) },
    { id: "reduced", label: "Reduced scope", result: createScenario(input, "reduced", thresholds, serviceCatalog) },
    { id: "partner", label: "Partner-supported", result: createScenario(input, "partner", thresholds, serviceCatalog) },
    { id: "timeline", label: "Extended timeline", result: createScenario(input, "timeline", thresholds, serviceCatalog) }
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
        <small>{totalDeals === 1 ? "qualification saved" : "qualifications saved"}</small>
      </div>
      <div className="metric-grid">
        <Metric label="Avg Risk" value={totalDeals ? averageScore.toFixed(2) : "N/A"} />
        <Metric label="Pending" value={String(pendingApprovals)} />
        <Metric label="High Risk" value={String(highRiskDeals)} />
        <Metric label="Reviewed" value={String(summaries.filter((summary) => summary.approvalStatus === "Approved").length)} />
      </div>
      <button className="primary-action summary-action" onClick={onNew} type="button">
        <Plus size={16} aria-hidden="true" />
        New Qualification
      </button>
      <div className="dashboard-recent">
        <strong>Recent Deals</strong>
        {recentDeals.length === 0 ? (
          <span>No qualifications yet.</span>
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
      <div className="mini-workflow">
        <strong>Workflow</strong>
        {recommendedWorkflow.slice(0, 7).map((item) => (
          <span key={item.step}>{item.step}</span>
        ))}
        <small>Then generate AI guidance, export, or submit for management review.</small>
      </div>
      <button className="primary-action summary-action" onClick={onStart} type="button">
        <Plus size={16} aria-hidden="true" />
        New Qualification
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
  const activeCount = config.serviceCatalog.filter((service) => !service.disabled).length;

  return (
    <aside className="result-panel help-summary">
      <div className="dashboard-summary-hero">
        <span>Admin</span>
        <strong>{activeCount}</strong>
        <small>active catalogue services</small>
      </div>
      <div className="help-checklist">
        <strong>Configuration affects:</strong>
        <span>Default weights for new qualifications</span>
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
        <Metric label="Risk" value={isValid ? result.weightedRiskScore.toFixed(2) : "Pending"} />
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
          <span>Management Review</span>
          <strong>{approvalStatus}</strong>
        </div>
        <label className="field">
          <span>Approver</span>
          <input value={approver} onChange={(event) => onApproverChange(event.target.value)} placeholder="Approver name" />
        </label>
        <label className="field">
          <span>Review Notes</span>
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
    { label: "Commercial", value: result.commercialRiskScore ?? 0 },
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
      {state === "saving" ? "Saving qualification..." : state === "saved" ? "Qualification saved." : "Qualification could not be saved."}
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

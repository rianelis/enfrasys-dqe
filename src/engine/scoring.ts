export type ServiceGroup = "cloud" | "appIntegration" | "dataAi" | "security" | "industry" | "managedAdvisory";

export type Service = {
  id: string;
  group: ServiceGroup;
  name: string;
  description: string;
  defaultRequired: boolean;
  defaultCapability: CapabilityScores;
};

export type CapabilityScores = {
  skills: number;
  tools: number;
  experience: number;
};

export type RiskGroup = "development" | "time" | "operations";

export type RiskFactor = {
  id: string;
  group: RiskGroup;
  label: string;
  guidance: string;
  defaultScore: number;
};

export type DealOverview = {
  customer: string;
  opportunity: string;
  owner: string;
  bdOwner: string;
  solutionOwner: string;
  contactName: string;
  contactRole: string;
  opportunityType: string;
  stage: string;
  dealValue: string;
  sector: string;
  timeline: string;
  procurementType: string;
  deadlineDate: string;
  budgetConfirmed: string;
  decisionMakerIdentified: string;
  fundingSourceKnown: string;
  partnerDependency: string;
  marginConfidence: string;
  winProbability: string;
  proposalStatus: string;
  poSoReference: string;
  notes: string;
};

export type DqeInput = {
  overview: DealOverview;
  requiredServices: Record<string, boolean>;
  capability: Record<string, CapabilityScores>;
  risk: Record<string, number>;
  weights: Record<RiskGroup, number>;
};

export type DqeResult = {
  selectedServices: number;
  capabilityScore: number | null;
  riskAverages: Record<RiskGroup, number>;
  weightedRiskScore: number;
  status: "green" | "amber" | "red";
  statusLabel: string;
  recommendation: string;
  flags: string[];
  explanations: string[];
};

export type ScoreThresholds = {
  greenMax: number;
  amberMax: number;
};

export const defaultThresholds: ScoreThresholds = {
  greenMax: 2.5,
  amberMax: 3.5
};

export const services: Service[] = [
  {
    id: "azureLandingZone",
    group: "cloud",
    name: "Azure Landing Zone",
    description: "CAF-aligned subscriptions, identity, network, policy, and governance foundation",
    defaultRequired: true,
    defaultCapability: { skills: 4, tools: 4, experience: 4 }
  },
  {
    id: "cloudMigration",
    group: "cloud",
    name: "Cloud Migration",
    description: "Lift and shift, re-platform or re-architect to Azure",
    defaultRequired: true,
    defaultCapability: { skills: 4, tools: 4, experience: 4 }
  },
  {
    id: "azureInfrastructure",
    group: "cloud",
    name: "Azure Infrastructure",
    description: "IaaS, PaaS, VMs, networking, storage on Azure",
    defaultRequired: true,
    defaultCapability: { skills: 4, tools: 4, experience: 4 }
  },
  {
    id: "hybridMultiCloud",
    group: "cloud",
    name: "Hybrid Connectivity",
    description: "On-premise, Azure Arc, ExpressRoute, VPN, DNS, and network integration",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "backupDr",
    group: "cloud",
    name: "Backup & Disaster Recovery",
    description: "Azure Backup, Site Recovery, business continuity",
    defaultRequired: true,
    defaultCapability: { skills: 4, tools: 4, experience: 4 }
  },
  {
    id: "microsoft365",
    group: "managedAdvisory",
    name: "Microsoft 365",
    description: "Exchange, Teams, SharePoint, OneDrive deployment",
    defaultRequired: false,
    defaultCapability: { skills: 4, tools: 4, experience: 4 }
  },
  {
    id: "modernWorkplace",
    group: "managedAdvisory",
    name: "Modern Workplace",
    description: "Windows 365, AVD, Intune, device management",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "powerPlatform",
    group: "industry",
    name: "Business Applications",
    description: "Power Platform, workflow automation, reporting apps, and business process tooling",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "appModernization",
    group: "appIntegration",
    name: "Application Modernisation",
    description: "Legacy app re-architecture, containers, microservices",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "apiMiddlewareIntegration",
    group: "appIntegration",
    name: "API / Middleware Integration",
    description: "Systems integration, middleware, API gateway, eventing, and data exchange",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "containerisation",
    group: "appIntegration",
    name: "Containerisation",
    description: "Container strategy, AKS, app packaging, runtime standards, and platform readiness",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "devopsCicd",
    group: "appIntegration",
    name: "DevOps / CI/CD",
    description: "Azure DevOps, GitHub workflows, release pipelines, IaC, and deployment governance",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "zeroTrust",
    group: "security",
    name: "Zero Trust Security",
    description: "Identity, conditional access, MFA, Microsoft Sentinel",
    defaultRequired: true,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "endpointProtection",
    group: "security",
    name: "Defender / XDR",
    description: "Microsoft Defender suite, EDR/XDR, threat hunting, and response workflow",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "complianceGovernance",
    group: "security",
    name: "Compliance & Governance",
    description: "PDPA, ISO 27001, data classification, Purview",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "identityAccess",
    group: "security",
    name: "IAM",
    description: "Azure AD, SSO, PIM, B2B/B2C identity",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "socMonitoring",
    group: "security",
    name: "SOC / Monitoring",
    description: "Sentinel, SOC operations, monitoring design, alerting, and incident response flow",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "microsoftFabric",
    group: "dataAi",
    name: "Microsoft Fabric",
    description: "Fabric workspace, lakehouse, pipelines, semantic model, and reporting readiness",
    defaultRequired: true,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "dataAnalytics",
    group: "dataAi",
    name: "Data Platform",
    description: "Azure Data Factory, Synapse, lakehouse, data engineering, and analytics foundation",
    defaultRequired: true,
    defaultCapability: { skills: 4, tools: 3, experience: 3 }
  },
  {
    id: "aiGenAiSolutions",
    group: "dataAi",
    name: "AI / GenAI Solutions",
    description: "AI solutioning, prompt workflows, copilots, assistants, and responsible AI controls",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 2 }
  },
  {
    id: "ragKnowledgeSearch",
    group: "dataAi",
    name: "RAG / Knowledge Search",
    description: "Document ingestion, embeddings, vector search, grounding, and answer evaluation",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 2 }
  },
  {
    id: "biReporting",
    group: "dataAi",
    name: "BI & Reporting",
    description: "Power BI, executive dashboards, semantic models, and KPI reporting",
    defaultRequired: false,
    defaultCapability: { skills: 4, tools: 4, experience: 3 }
  },
  {
    id: "smartCityIot",
    group: "industry",
    name: "Smart City / IoT",
    description: "IoT platforms, smart operations, sensors, edge connectivity, and command centre feeds",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "vmsVideoAnalytics",
    group: "industry",
    name: "VMS / Video Analytics",
    description: "Video management, camera/vendor integration, analytics, retention, and operations model",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 2 }
  },
  {
    id: "tollTransportSystems",
    group: "industry",
    name: "Toll / Transport Systems",
    description: "Highway, tolling, transport operations, integration, and platform dependency review",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 2, experience: 2 }
  },
  {
    id: "managedServices",
    group: "managedAdvisory",
    name: "Managed Services",
    description: "NOC/SOC, L1-L3 support, SLA-based operations",
    defaultRequired: true,
    defaultCapability: { skills: 4, tools: 4, experience: 4 }
  },
  {
    id: "assessmentWorkshop",
    group: "managedAdvisory",
    name: "Assessment / Workshop",
    description: "Discovery workshops, cloud readiness, risk review, and qualification artefacts",
    defaultRequired: false,
    defaultCapability: { skills: 4, tools: 3, experience: 4 }
  },
  {
    id: "advisoryStrategy",
    group: "managedAdvisory",
    name: "Architecture Advisory",
    description: "Digital roadmap, architecture design, change management",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "trainingAdoption",
    group: "managedAdvisory",
    name: "Training & Adoption",
    description: "End-user training, LMS, change adoption programmes",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  },
  {
    id: "finops",
    group: "managedAdvisory",
    name: "FinOps",
    description: "Cloud cost governance, consumption review, tagging, budget alerts, and optimisation",
    defaultRequired: false,
    defaultCapability: { skills: 3, tools: 3, experience: 3 }
  }
];

export const riskFactors: RiskFactor[] = [
  {
    id: "skillAvailability",
    group: "development",
    label: "Skill availability for this engagement",
    guidance: "1 = team fully capable, 3 = partial gap, 5 = critical skill gap",
    defaultScore: 2
  },
  {
    id: "toolReadiness",
    group: "development",
    label: "Tool & technology readiness",
    guidance: "1 = all tools ready, 3 = some procurement, 5 = major procurement",
    defaultScore: 2
  },
  {
    id: "vendorDependency",
    group: "development",
    label: "Third-party / vendor dependency",
    guidance: "1 = self-sufficient, 3 = some reliance, 5 = heavy dependency",
    defaultScore: 2
  },
  {
    id: "solutionComplexity",
    group: "development",
    label: "Solution complexity & innovation",
    guidance: "1 = standard solution, 3 = custom build, 5 = novel or R&D needed",
    defaultScore: 3
  },
  {
    id: "deadlineFeasibility",
    group: "time",
    label: "Deadline feasibility",
    guidance: "1 = comfortable, 3 = tight but achievable, 5 = not achievable",
    defaultScore: 3
  },
  {
    id: "teamAvailability",
    group: "time",
    label: "Resource & team availability",
    guidance: "1 = available now, 3 = partial availability, 5 = no bandwidth",
    defaultScore: 3
  },
  {
    id: "approvalLeadTime",
    group: "time",
    label: "Procurement & approval lead time",
    guidance: "1 = no blockers, 3 = some approvals, 5 = long cycles expected",
    defaultScore: 3
  },
  {
    id: "concurrentLoad",
    group: "time",
    label: "Concurrent project load",
    guidance: "1 = team is free, 3 = managing other projects, 5 = overloaded",
    defaultScore: 2
  },
  {
    id: "slaFeasibility",
    group: "operations",
    label: "SLA commitment feasibility",
    guidance: "1 = easily met, 3 = stretch but possible, 5 = cannot meet SLAs",
    defaultScore: 2
  },
  {
    id: "supportCapacity",
    group: "operations",
    label: "Post-delivery support capacity",
    guidance: "1 = full capacity, 3 = partial capacity, 5 = no support bandwidth",
    defaultScore: 2
  },
  {
    id: "customerMaturity",
    group: "operations",
    label: "Customer IT maturity",
    guidance: "1 = highly capable, 3 = moderate maturity, 5 = high support burden",
    defaultScore: 3
  },
  {
    id: "runbookReadiness",
    group: "operations",
    label: "Escalation & runbook readiness",
    guidance: "1 = documented playbooks, 3 = partial docs, 5 = no runbooks",
    defaultScore: 3
  }
];

export const groupLabels: Record<ServiceGroup | RiskGroup, string> = {
  cloud: "Cloud & Infrastructure",
  appIntegration: "Application & Integration",
  dataAi: "Data, AI & Analytics",
  security: "Security & Governance",
  industry: "Industry Solutions",
  managedAdvisory: "Managed & Advisory Services",
  development: "Development Risk",
  time: "Time Risk",
  operations: "Operations Risk"
};

export const defaultOverview: DealOverview = {
  customer: "Kementerian Kewangan Malaysia",
  opportunity: "Cloud Migration Phase 1",
  owner: "Presales Team",
  bdOwner: "BD Team",
  solutionOwner: "Solution Architect",
  contactName: "",
  contactRole: "IT Director",
  opportunityType: "Tender / RFP",
  stage: "RFP/ITT Received",
  dealValue: "RM 500K - RM 1M",
  sector: "Government (Federal)",
  timeline: "3-6 months",
  procurementType: "Open Tender",
  deadlineDate: "",
  budgetConfirmed: "Unknown",
  decisionMakerIdentified: "Unknown",
  fundingSourceKnown: "Unknown",
  partnerDependency: "Medium",
  marginConfidence: "Medium",
  winProbability: "Medium",
  proposalStatus: "Qualification",
  poSoReference: "",
  notes: "Top requirements: Azure migration, security baseline, managed support readiness."
};

export const defaultInput: DqeInput = {
  overview: defaultOverview,
  requiredServices: Object.fromEntries(services.map((service) => [service.id, service.defaultRequired])),
  capability: Object.fromEntries(services.map((service) => [service.id, service.defaultCapability])),
  risk: Object.fromEntries(riskFactors.map((factor) => [factor.id, factor.defaultScore])),
  weights: {
    development: 0.35,
    time: 0.35,
    operations: 0.3
  }
};

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const riskLabelById = Object.fromEntries(riskFactors.map((factor) => [factor.id, factor.label]));

function buildExplanations(input: DqeInput, resultShape: Pick<DqeResult, "capabilityScore" | "riskAverages" | "weightedRiskScore">) {
  const highRiskFactors = riskFactors
    .filter((factor) => input.risk[factor.id] >= 4)
    .map((factor) => factor.label.toLowerCase());

  const explanations: string[] = [];
  if (highRiskFactors.length > 0) {
    explanations.push(`Score increased because ${highRiskFactors.slice(0, 3).join(", ")} ${highRiskFactors.length === 1 ? "is" : "are"} high-risk.`);
  } else {
    explanations.push("Score is controlled because no individual risk factor is currently marked high-risk.");
  }

  const riskiestGroup = (Object.entries(resultShape.riskAverages) as Array<[RiskGroup, number]>).sort((a, b) => b[1] - a[1])[0];
  explanations.push(`${groupLabels[riskiestGroup[0]]} is the largest risk driver at ${riskiestGroup[1].toFixed(2)}.`);

  if (resultShape.capabilityScore !== null && resultShape.capabilityScore < 3) {
    explanations.push(`Capability alignment is pulling the score upward because the overall capability score is ${resultShape.capabilityScore.toFixed(2)}.`);
  } else if (resultShape.capabilityScore !== null) {
    explanations.push(`Capability alignment is helping offset delivery risk with an overall score of ${resultShape.capabilityScore.toFixed(2)}.`);
  }

  const weightFocus = (Object.entries(input.weights) as Array<[RiskGroup, number]>).sort((a, b) => b[1] - a[1])[0];
  explanations.push(`${groupLabels[weightFocus[0]]} has the strongest weighting at ${Math.round(weightFocus[1] * 100)}%.`);

  return explanations;
}

function buildRecommendation(status: DqeResult["status"], input: DqeInput, flags: string[]) {
  const highRisks = riskFactors.filter((factor) => input.risk[factor.id] >= 4);
  const actions = highRisks.map((factor) => {
    if (factor.id === "deadlineFeasibility") return "renegotiate the timeline or reduce scope";
    if (factor.id === "teamAvailability") return "confirm delivery capacity before commercial commitment";
    if (factor.id === "skillAvailability") return "assign a certified lead or secure partner support";
    if (factor.id === "slaFeasibility") return "review SLA commitments with operations leadership";
    if (factor.id === "customerMaturity") return "include additional onboarding and support effort";
    return `mitigate ${riskLabelById[factor.id].toLowerCase()}`;
  });

  const context = input.overview.notes.trim()
    ? ` Deal notes indicate: ${input.overview.notes.trim()}`
    : "";
  const actionText = actions.length > 0 ? ` Priority actions: ${Array.from(new Set(actions)).join("; ")}.` : "";
  const aiFuture = " This can later be replaced or augmented with AI-generated narrative using the same structured inputs.";

  if (status === "green") {
    return `Proceed: this deal is well-aligned with Enfrasys capabilities. Assign a Solution Architect, draft the SOW with clear scope boundaries, and apply standard delivery governance.${context}${aiFuture}`;
  }

  if (status === "amber") {
    return `Proceed with caution: address flagged risks before committing, confirm delivery capacity, secure management sign-off on SLA commitments, and add a 15-20% contingency buffer.${actionText}${context}${aiFuture}`;
  }

  return `Escalate: route to Solutions Director and Head of Delivery, identify partners for capability gaps, phase the scope where possible, and do not commit without leadership approval.${actionText} Active flags: ${flags.filter((flag) => !flag.startsWith("Skill gap risk") && !flag.startsWith("Deadline risk") && !flag.startsWith("Resource availability") && !flag.startsWith("SLA commitments are") && !flag.startsWith("Customer IT maturity") && !flag.startsWith("Capability level")).join(" ")}${context}${aiFuture}`;
}

export function calculateDqe(input: DqeInput, thresholds: ScoreThresholds = defaultThresholds): DqeResult {
  const selected = services.filter((service) => input.requiredServices[service.id]);
  const capabilityValues = selected.map((service) => {
    const score = input.capability[service.id] ?? service.defaultCapability;
    return average([score.skills, score.tools, score.experience]);
  });

  const capabilityScore = capabilityValues.length > 0 ? average(capabilityValues) : null;
  const capabilityRisk = capabilityScore === null ? 2.5 : 6 - capabilityScore;

  const riskAverages: Record<RiskGroup, number> = {
    development: average(riskFactors.filter((factor) => factor.group === "development").map((factor) => input.risk[factor.id])),
    time: average(riskFactors.filter((factor) => factor.group === "time").map((factor) => input.risk[factor.id])),
    operations: average(riskFactors.filter((factor) => factor.group === "operations").map((factor) => input.risk[factor.id]))
  };

  const blendedDevelopmentRisk = riskAverages.development * 0.7 + capabilityRisk * 0.3;
  const weightedRiskScore = round2(
    blendedDevelopmentRisk * input.weights.development +
      riskAverages.time * input.weights.time +
      riskAverages.operations * input.weights.operations
  );

  const status = weightedRiskScore <= thresholds.greenMax ? "green" : weightedRiskScore <= thresholds.amberMax ? "amber" : "red";
  const statusLabel =
    status === "green" ? "Proceed - Low Risk" : status === "amber" ? "Proceed With Caution" : "High Risk - Escalate";

  const flags = [
    input.risk.skillAvailability >= 4
      ? "Critical skill gap detected - subcontract or upskill before committing."
      : "Skill gap risk is within acceptable range.",
    input.risk.deadlineFeasibility >= 4
      ? "Deadline appears infeasible - renegotiate scope or timeline."
      : "Deadline risk is manageable.",
    input.risk.teamAvailability >= 4
      ? "Resource bandwidth is constrained - resolve capacity conflict first."
      : "Resource availability is adequate.",
    input.risk.slaFeasibility >= 4
      ? "SLA commitments exceed operations capacity - escalate to Head of Operations."
      : "SLA commitments are feasible.",
    input.risk.customerMaturity >= 4
      ? "Low customer IT maturity - build extra support cost into commercial."
      : "Customer IT maturity is manageable.",
    capabilityScore !== null && capabilityScore < 2.5
      ? "Overall capability score is too low - consider scoping down or partnering."
      : "Capability level is sufficient for this deal."
  ];

  const resultShape = {
    capabilityScore: capabilityScore === null ? null : round2(capabilityScore),
    riskAverages: {
      development: round2(riskAverages.development),
      time: round2(riskAverages.time),
      operations: round2(riskAverages.operations)
    },
    weightedRiskScore
  };

  const explanations = buildExplanations(input, resultShape);
  const recommendation = buildRecommendation(status, input, flags);

  return {
    selectedServices: selected.length,
    capabilityScore: resultShape.capabilityScore,
    riskAverages: resultShape.riskAverages,
    weightedRiskScore,
    status,
    statusLabel,
    recommendation,
    flags,
    explanations
  };
}

import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { calculateDqe, defaultInput, DqeInput, DqeResult, services, riskFactors, ScoreThresholds } from "../src/engine/scoring";

const app = express();
const port = Number(process.env.PORT ?? 4100);
const host = process.env.HOST ?? "127.0.0.1";
const databaseUrl = process.env.DATABASE_URL;
const databasePath = join(process.cwd(), "server", "data", "dqe.sqlite");
const distPath = join(process.cwd(), "dist");

type ApprovalStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Needs Revision";

type AdminConfig = {
  defaultWeights: DqeInput["weights"];
  thresholds: ScoreThresholds;
  recommendationRules: string;
};

const defaultAdminConfig: AdminConfig = {
  defaultWeights: defaultInput.weights,
  thresholds: {
    greenMax: 2.5,
    amberMax: 3.5
  },
  recommendationRules:
    "Green: proceed with standard governance.\nAmber: confirm capacity, resolve flagged risks, add contingency.\nRed: escalate to leadership before committing."
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

type AssessmentSummary = Omit<AssessmentRecord, "input" | "result"> & {
  customer: string;
  owner: string;
  statusLabel: string;
  score: number;
};

type AssessmentRow = {
  id: string;
  title: string;
  customer: string;
  owner: string;
  status_label: string;
  score: number;
  approval_status: ApprovalStatus;
  submitted_at: string | null;
  decided_at: string | null;
  approver: string;
  approval_notes: string;
  input_json: string;
  result_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type Store = {
  kind: "sqlite" | "postgres";
  listAssessments: () => Promise<AssessmentSummary[]>;
  getAssessment: (id: string) => Promise<AssessmentRecord | null>;
  createAssessment: (input: DqeInput, thresholds?: ScoreThresholds) => Promise<AssessmentRecord>;
  updateAssessment: (id: string, input: DqeInput, thresholds?: ScoreThresholds) => Promise<AssessmentRecord | null>;
  archiveAssessment: (id: string) => Promise<boolean>;
  getAdminConfig: () => Promise<AdminConfig>;
  updateAdminConfig: (config: AdminConfig) => Promise<AdminConfig>;
  updateApproval: (
    id: string,
    action: "submit" | "approve" | "reject" | "revision",
    approver: string,
    notes: string
  ) => Promise<AssessmentRecord | null>;
};

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function getTitle(input: DqeInput) {
  return input.overview.opportunity || input.overview.customer || "Untitled assessment";
}

function rowToRecord(row: AssessmentRow): AssessmentRecord {
  return {
    id: row.id,
    title: row.title,
    input: JSON.parse(row.input_json) as DqeInput,
    result: JSON.parse(row.result_json) as DqeResult,
    approvalStatus: row.approval_status,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    approver: row.approver,
    approvalNotes: row.approval_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at
  };
}

function rowToSummary(row: AssessmentRow): AssessmentSummary {
  return {
    id: row.id,
    title: row.title,
    customer: row.customer,
    owner: row.owner,
    statusLabel: row.status_label,
    score: row.score,
    approvalStatus: row.approval_status,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    approver: row.approver,
    approvalNotes: row.approval_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at
  };
}

function approvalFromAction(action: "submit" | "approve" | "reject" | "revision"): ApprovalStatus {
  if (action === "submit") return "Submitted";
  if (action === "approve") return "Approved";
  if (action === "reject") return "Rejected";
  return "Needs Revision";
}

async function createSqliteStore(): Promise<Store> {
  await mkdir(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      customer TEXT NOT NULL,
      owner TEXT NOT NULL,
      status_label TEXT NOT NULL,
      score REAL NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'Draft',
      submitted_at TEXT,
      decided_at TEXT,
      approver TEXT NOT NULL DEFAULT '',
      approval_notes TEXT NOT NULL DEFAULT '',
      input_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  for (const ddl of [
    "ALTER TABLE assessments ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'Draft'",
    "ALTER TABLE assessments ADD COLUMN submitted_at TEXT",
    "ALTER TABLE assessments ADD COLUMN decided_at TEXT",
    "ALTER TABLE assessments ADD COLUMN approver TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE assessments ADD COLUMN approval_notes TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE assessments ADD COLUMN archived_at TEXT"
  ]) {
    try {
      db.exec(ddl);
    } catch {
      // Existing local databases already have the column.
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assessments_updated_at ON assessments(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assessments_owner ON assessments(owner);
    CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status_label);
    CREATE INDEX IF NOT EXISTS idx_assessments_approval ON assessments(approval_status);
    CREATE INDEX IF NOT EXISTS idx_assessments_archived ON assessments(archived_at);
  `);

  const selectColumns = `
    id, title, customer, owner, status_label, score, approval_status, submitted_at,
    decided_at, approver, approval_notes, input_json, result_json, created_at, updated_at, archived_at
  `;

  const getAssessmentById = async (id: string) => {
    const row = db.prepare(`SELECT ${selectColumns} FROM assessments WHERE id = ? AND archived_at IS NULL`).get(id) as AssessmentRow | undefined;
    return row ? rowToRecord(row) : null;
  };

  const getStoredAdminConfig = async () => {
    const row = db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get("admin_config") as { value_json: string } | undefined;
    return row ? ({ ...defaultAdminConfig, ...(JSON.parse(row.value_json) as AdminConfig) }) : defaultAdminConfig;
  };

  const updateStoredAdminConfig = async (config: AdminConfig) => {
    const now = new Date().toISOString();
    const normalized: AdminConfig = { ...defaultAdminConfig, ...config };
    db.prepare(`
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run("admin_config", JSON.stringify(normalized), now);
    return normalized;
  };

  const saveRecord = (record: AssessmentRecord) => {
    const overview = record.input.overview;
    db.prepare(`
      INSERT INTO assessments (
        id, title, customer, owner, status_label, score, approval_status, submitted_at,
        decided_at, approver, approval_notes, input_json, result_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        customer = excluded.customer,
        owner = excluded.owner,
        status_label = excluded.status_label,
        score = excluded.score,
        input_json = excluded.input_json,
        result_json = excluded.result_json,
        updated_at = excluded.updated_at
    `).run(
      record.id,
      record.title,
      overview.customer,
      overview.owner,
      record.result.statusLabel,
      record.result.weightedRiskScore,
      record.approvalStatus,
      record.submittedAt,
      record.decidedAt,
      record.approver,
      record.approvalNotes,
      JSON.stringify(record.input),
      JSON.stringify(record.result),
      record.createdAt,
      record.updatedAt
    );
  };

  return {
    kind: "sqlite",
    async listAssessments() {
      const rows = db.prepare(`SELECT ${selectColumns} FROM assessments WHERE archived_at IS NULL ORDER BY updated_at DESC`).all() as AssessmentRow[];
      return rows.map(rowToSummary);
    },
    getAssessment: getAssessmentById,
    async createAssessment(input, thresholds) {
      const now = new Date().toISOString();
      const record: AssessmentRecord = {
        id: randomUUID(),
        title: getTitle(input),
        input,
        result: calculateDqe(input, thresholds),
        approvalStatus: "Draft",
        submittedAt: null,
        decidedAt: null,
        approver: "",
        approvalNotes: "",
        createdAt: now,
        updatedAt: now,
        archivedAt: null
      };
      saveRecord(record);
      return record;
    },
    async updateAssessment(id, input, thresholds) {
      const existing = await getAssessmentById(id);
      if (!existing) return null;

      const updated: AssessmentRecord = {
        ...existing,
        title: getTitle(input),
        input,
        result: calculateDqe(input, thresholds),
        updatedAt: new Date().toISOString()
      };
      saveRecord(updated);
      return updated;
    },
    async archiveAssessment(id) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE assessments SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL`).run(now, now, id);
      return result.changes > 0;
    },
    getAdminConfig: getStoredAdminConfig,
    updateAdminConfig: updateStoredAdminConfig,
    async updateApproval(id, action, approver, notes) {
      const existing = await getAssessmentById(id);
      if (!existing) return null;

      const now = new Date().toISOString();
      const status = approvalFromAction(action);
      const updated: AssessmentRecord = {
        ...existing,
        approvalStatus: status,
        submittedAt: action === "submit" ? now : existing.submittedAt,
        decidedAt: action === "approve" || action === "reject" || action === "revision" ? now : existing.decidedAt,
        approver,
        approvalNotes: notes,
        updatedAt: now
      };

      db.prepare(`
        UPDATE assessments
        SET approval_status = ?, submitted_at = ?, decided_at = ?, approver = ?, approval_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(updated.approvalStatus, updated.submittedAt, updated.decidedAt, updated.approver, updated.approvalNotes, updated.updatedAt, id);
      return updated;
    }
  };
}

async function createPostgresStore(url: string): Promise<Store> {
  const pool = new pg.Pool({ connectionString: url, ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      customer TEXT NOT NULL,
      owner TEXT NOT NULL,
      status_label TEXT NOT NULL,
      score DOUBLE PRECISION NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'Draft',
      submitted_at TEXT,
      decided_at TEXT,
      approver TEXT NOT NULL DEFAULT '',
      approval_notes TEXT NOT NULL DEFAULT '',
      input_json JSONB NOT NULL,
      result_json JSONB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assessments_updated_at ON assessments(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assessments_owner ON assessments(owner);
    CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status_label);
    CREATE INDEX IF NOT EXISTS idx_assessments_approval ON assessments(approval_status);
    CREATE INDEX IF NOT EXISTS idx_assessments_archived ON assessments(archived_at);
  `);

  for (const ddl of [
    "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Draft'",
    "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS submitted_at TEXT",
    "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS decided_at TEXT",
    "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS approver TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS approval_notes TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS archived_at TEXT"
  ]) {
    await pool.query(ddl);
  }

  const selectColumns = `
    id, title, customer, owner, status_label, score, approval_status, submitted_at,
    decided_at, approver, approval_notes, input_json::text, result_json::text, created_at, updated_at, archived_at
  `;

  const getAssessmentById = async (id: string) => {
    const result = await pool.query<AssessmentRow>(`SELECT ${selectColumns} FROM assessments WHERE id = $1 AND archived_at IS NULL`, [id]);
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  };

  const getStoredAdminConfig = async () => {
    const result = await pool.query<{ value_json: AdminConfig }>(`SELECT value_json FROM app_settings WHERE key = $1`, ["admin_config"]);
    return result.rows[0]?.value_json ? { ...defaultAdminConfig, ...result.rows[0].value_json } : defaultAdminConfig;
  };

  const updateStoredAdminConfig = async (config: AdminConfig) => {
    const now = new Date().toISOString();
    const normalized: AdminConfig = { ...defaultAdminConfig, ...config };
    await pool.query(
      `
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `,
      ["admin_config", JSON.stringify(normalized), now]
    );
    return normalized;
  };

  const saveRecord = async (record: AssessmentRecord) => {
    const overview = record.input.overview;
    await pool.query(
      `
        INSERT INTO assessments (
          id, title, customer, owner, status_label, score, approval_status, submitted_at,
          decided_at, approver, approval_notes, input_json, result_json, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          customer = excluded.customer,
          owner = excluded.owner,
          status_label = excluded.status_label,
          score = excluded.score,
          input_json = excluded.input_json,
          result_json = excluded.result_json,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.title,
        overview.customer,
        overview.owner,
        record.result.statusLabel,
        record.result.weightedRiskScore,
        record.approvalStatus,
        record.submittedAt,
        record.decidedAt,
        record.approver,
        record.approvalNotes,
        JSON.stringify(record.input),
        JSON.stringify(record.result),
        record.createdAt,
        record.updatedAt
      ]
    );
  };

  return {
    kind: "postgres",
    async listAssessments() {
      const result = await pool.query<AssessmentRow>(`SELECT ${selectColumns} FROM assessments WHERE archived_at IS NULL ORDER BY updated_at DESC`);
      return result.rows.map(rowToSummary);
    },
    getAssessment: getAssessmentById,
    async createAssessment(input, thresholds) {
      const now = new Date().toISOString();
      const record: AssessmentRecord = {
        id: randomUUID(),
        title: getTitle(input),
        input,
        result: calculateDqe(input, thresholds),
        approvalStatus: "Draft",
        submittedAt: null,
        decidedAt: null,
        approver: "",
        approvalNotes: "",
        createdAt: now,
        updatedAt: now,
        archivedAt: null
      };
      await saveRecord(record);
      return record;
    },
    async updateAssessment(id, input, thresholds) {
      const existing = await getAssessmentById(id);
      if (!existing) return null;

      const updated: AssessmentRecord = {
        ...existing,
        title: getTitle(input),
        input,
        result: calculateDqe(input, thresholds),
        updatedAt: new Date().toISOString()
      };
      await saveRecord(updated);
      return updated;
    },
    async archiveAssessment(id) {
      const now = new Date().toISOString();
      const result = await pool.query(`UPDATE assessments SET archived_at = $1, updated_at = $2 WHERE id = $3 AND archived_at IS NULL`, [now, now, id]);
      return (result.rowCount ?? 0) > 0;
    },
    getAdminConfig: getStoredAdminConfig,
    updateAdminConfig: updateStoredAdminConfig,
    async updateApproval(id, action, approver, notes) {
      const existing = await getAssessmentById(id);
      if (!existing) return null;

      const now = new Date().toISOString();
      const updated: AssessmentRecord = {
        ...existing,
        approvalStatus: approvalFromAction(action),
        submittedAt: action === "submit" ? now : existing.submittedAt,
        decidedAt: action === "approve" || action === "reject" || action === "revision" ? now : existing.decidedAt,
        approver,
        approvalNotes: notes,
        updatedAt: now
      };

      await pool.query(
        `
          UPDATE assessments
          SET approval_status = $1, submitted_at = $2, decided_at = $3, approver = $4, approval_notes = $5, updated_at = $6
          WHERE id = $7
        `,
        [updated.approvalStatus, updated.submittedAt, updated.decidedAt, updated.approver, updated.approvalNotes, updated.updatedAt, id]
      );
      return updated;
    }
  };
}

const store = databaseUrl ? await createPostgresStore(databaseUrl) : await createSqliteStore();

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "enfrasys-dqe-api", database: store.kind });
});

app.get("/api/model", (_request, response) => {
  response.json({
    services,
    riskFactors,
    defaultInput
  });
});

app.get("/api/admin/config", async (_request, response) => {
  response.json(await store.getAdminConfig());
});

app.put("/api/admin/config", async (request, response) => {
  response.json(await store.updateAdminConfig(request.body as AdminConfig));
});

app.post("/api/score", (request, response) => {
  try {
    const input = (request.body?.input ?? request.body) as DqeInput;
    const thresholds = request.body?.thresholds as ScoreThresholds | undefined;
    response.json(calculateDqe(input, thresholds));
  } catch (error) {
    response.status(400).json({
      message: "Unable to score deal qualification input.",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

function fallbackAiRecommendation(input: DqeInput, result: DqeResult) {
  const riskScores = input.risk ?? defaultInput.risk;
  const topRisks = riskFactors
    .map((factor) => ({ label: factor.label, score: riskScores[factor.id] ?? factor.defaultScore }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return [
    `Executive recommendation: ${result.statusLabel}.`,
    `Primary focus should be ${topRisks.map((risk) => `${risk.label} (${risk.score}/5)`).join(", ")}.`,
    result.status === "green"
      ? "Proceed with standard presales governance and assign a Solution Architect."
      : result.status === "amber"
        ? "Proceed only after the top risk owners confirm mitigation actions, delivery capacity, and contingency."
        : "Escalate to leadership before committing scope, timeline, or commercial terms."
  ].join(" ");
}

function extractGeminiText(payload: unknown) {
  const response = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return response.candidates
    ?.flatMap((candidate) => candidate.content?.parts?.map((part) => part.text ?? "") ?? [])
    .join("\n")
    .trim() ?? "";
}

app.post("/api/ai-recommendation", async (request, response) => {
  const input = (request.body?.input ?? defaultInput) as DqeInput;
  const thresholds = request.body?.thresholds as ScoreThresholds | undefined;
  const result = (request.body?.result ?? calculateDqe(input, thresholds)) as DqeResult;
  const fallback = fallbackAiRecommendation(input, result);

  if (!process.env.GEMINI_API_KEY) {
    response.json({ source: "fallback", recommendation: fallback });
    return;
  }

  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are a senior presales qualification advisor. Write concise executive guidance for a deal review. Be specific, action-oriented, and avoid hype."
            }
          ]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  task: "Generate an executive DQE recommendation for this deal assessment.",
                  deal: input.overview,
                  selectedServices: services.filter((service) => input.requiredServices[service.id]).map((service) => service.name),
                  riskScores: input.risk,
                  weights: input.weights,
                  result
                })
              }
            ]
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      response.json({ source: "fallback", recommendation: fallback });
      return;
    }

    const payload = await aiResponse.json();
    response.json({ source: "gemini", recommendation: extractGeminiText(payload) || fallback });
  } catch {
    response.json({ source: "fallback", recommendation: fallback });
  }
});

app.get("/api/assessments", async (_request, response) => {
  response.json(await store.listAssessments());
});

app.get("/api/assessments/:id", async (request, response) => {
  const record = await store.getAssessment(request.params.id);
  if (!record) {
    response.status(404).json({ message: "Assessment not found." });
    return;
  }
  response.json(record);
});

app.post("/api/assessments", async (request, response) => {
  const record = await store.createAssessment(request.body.input ?? request.body, request.body.thresholds);
  response.status(201).json(record);
});

app.put("/api/assessments/:id", async (request, response) => {
  const updated = await store.updateAssessment(request.params.id, request.body.input ?? request.body, request.body.thresholds);
  if (!updated) {
    response.status(404).json({ message: "Assessment not found." });
    return;
  }
  response.json(updated);
});

app.delete("/api/assessments/:id", async (request, response) => {
  const archived = await store.archiveAssessment(request.params.id);
  if (!archived) {
    response.status(404).json({ message: "Assessment not found." });
    return;
  }
  response.status(204).send();
});

app.post("/api/assessments/:id/approval", async (request, response) => {
  const { action, approver = "", notes = "" } = request.body as {
    action?: "submit" | "approve" | "reject" | "revision";
    approver?: string;
    notes?: string;
  };

  if (!action || !["submit", "approve", "reject", "revision"].includes(action)) {
    response.status(400).json({ message: "Approval action must be submit, approve, reject, or revision." });
    return;
  }

  const updated = await store.updateApproval(request.params.id, action, approver, notes);
  if (!updated) {
    response.status(404).json({ message: "Assessment not found." });
    return;
  }
  response.json(updated);
});

if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((request, response, next) => {
    if (request.method === "GET" && !request.path.startsWith("/api")) {
      response.sendFile(join(distPath, "index.html"));
      return;
    }
    next();
  });
}

app.listen(port, host, () => {
  console.log(`DQE API listening on http://${host}:${port} (${store.kind})`);
});

-- Phase 1: Additive structural foundation — Territoire + Heritage domain models
-- No existing tables, columns, indexes, or foreign keys are removed or modified.
-- All new foreign-key columns are nullable; existing rows are unaffected.

-- ─── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "ProjectType" AS ENUM ('CHATEAU', 'MURAILLE', 'AUTRE');

-- 9 functional roles §15 CDC (distinct from the system Role enum on User.role)
CREATE TYPE "ProjectRole" AS ENUM (
  'ADMIN', 'MO', 'MOE', 'CULTURE', 'BET', 'LABORATOIRE', 'ENTREPRISE', 'CONSULTANT', 'PUBLIC'
);

CREATE TYPE "SequenceType" AS ENUM ('SEQUENCE', 'TOUR', 'PORTE', 'ZONE', 'OUVRAGE', 'AUTRE');
CREATE TYPE "EtatGeneral" AS ENUM ('BON', 'MOYEN', 'DEGRADE', 'CRITIQUE');
CREATE TYPE "NiveauRisque" AS ENUM ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE');

-- Proof system §7 CDC
CREATE TYPE "EvidenceStatus" AS ENUM ('OBS', 'DOC', 'TEM', 'HYP', 'INV', 'VAL');

-- Document lifecycle §11 CDC
CREATE TYPE "DocumentStatus" AS ENUM ('BROUILLON', 'EN_REVISION', 'SOUMIS', 'VALIDE', 'OBSOLETE');

-- Confidentiality levels §14 CDC
CREATE TYPE "Confidentialite" AS ENUM ('PUBLIE', 'INSTITUTIONNEL', 'PROJET', 'CONFIDENTIEL');

CREATE TYPE "InvestigationStatus" AS ENUM ('REQUISE', 'EN_COURS', 'TERMINEE');

-- Heritage decision types §6 CDC
CREATE TYPE "DecisionType" AS ENUM (
  'CONSERVER', 'ENTRETENIR', 'REPARER', 'CONSOLIDER',
  'REMPLACER_PONCTUEL', 'RESTITUER_EXCEPTIONNEL'
);

-- Gate numbers §12 CDC
CREATE TYPE "GateNumber" AS ENUM ('G0', 'G1', 'G2', 'G3', 'G4', 'G5');
CREATE TYPE "GateStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'VALIDE', 'REJETE');

-- ─── Additive columns on existing tables ─────────────────────────────────────

-- Project: code (nullable unique), type (with safe default), territoireId (nullable)
ALTER TABLE "Project" ADD COLUMN "code" TEXT;
ALTER TABLE "Project" ADD COLUMN "type" "ProjectType" NOT NULL DEFAULT 'AUTRE';
ALTER TABLE "Project" ADD COLUMN "territoireId" TEXT;

-- File: documentary metadata (all nullable) + confidentiality (with default)
ALTER TABLE "File" ADD COLUMN "docTitle"        TEXT;
ALTER TABLE "File" ADD COLUMN "docAuteur"       TEXT;
ALTER TABLE "File" ADD COLUMN "docSource"       TEXT;
ALTER TABLE "File" ADD COLUMN "docCategorie"    TEXT;
ALTER TABLE "File" ADD COLUMN "docVersion"      TEXT;
ALTER TABLE "File" ADD COLUMN "docStatut"       "DocumentStatus";
ALTER TABLE "File" ADD COLUMN "docNomenclature" TEXT;
ALTER TABLE "File" ADD COLUMN "confidentialite" "Confidentialite" NOT NULL DEFAULT 'PROJET';
ALTER TABLE "File" ADD COLUMN "sequenceId"      TEXT;

-- ─── New tables ───────────────────────────────────────────────────────────────

-- Territoire — extensible root node
CREATE TABLE "Territoire" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Territoire_pkey" PRIMARY KEY ("id")
);

-- ProjectMember — granular roles per project
CREATE TABLE "ProjectMember" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role"      "ProjectRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- Secteur — geographic/functional subdivision of a project
CREATE TABLE "Secteur" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Secteur_pkey" PRIMARY KEY ("id")
);

-- Sequence / Ouvrage — elementary heritage unit (fiche §6 CDC)
CREATE TABLE "Sequence" (
    "id"                   TEXT NOT NULL,
    "code"                 TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "type"                 "SequenceType" NOT NULL DEFAULT 'SEQUENCE',
    "projectId"            TEXT NOT NULL,
    "secteurId"            TEXT,
    -- Identification §6
    "tranche"              TEXT,
    "coordonnees"          TEXT,
    "longueurM"            DOUBLE PRECISION,
    "surfaceM2"            DOUBLE PRECISION,
    "facesAccessibles"     TEXT,
    "dateReleve"           TIMESTAMP(3),
    -- Patrimoine §6
    "datation"             TEXT,
    "systemeConstructif"   TEXT,
    "materiaux"            TEXT,
    "valeurPatrimoniale"   TEXT,
    "transformations"      TEXT,
    -- État §6
    "etatGeneral"          "EtatGeneral",
    "pathologiesObservees" TEXT,
    "niveauRisque"         "NiveauRisque",
    -- Diagnostic §6
    "causeProbable"        TEXT,
    "niveauCertitude"      TEXT,
    "betLaboratoire"       TEXT,
    -- Projet §6
    "traitementRetenu"     TEXT,
    "materiauxTraitement"  TEXT,
    "zoneTemoin"           TEXT,
    "detailTechnique"      TEXT,
    -- Mémoire §6
    "dateProchaine"        TIMESTAMP(3),
    "maintenanceRequise"   TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- Element — component of a sequence or ouvrage
CREATE TABLE "Element" (
    "id"          TEXT NOT NULL,
    "code"        TEXT,
    "name"        TEXT NOT NULL,
    "sequenceId"  TEXT,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Element_pkey" PRIMARY KEY ("id")
);

-- Observation — dated field note with evidence status §7 CDC
CREATE TABLE "Observation" (
    "id"          TEXT NOT NULL,
    "code"        TEXT,
    "description" TEXT NOT NULL,
    "statut"      "EvidenceStatus" NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL,
    "auteurId"    TEXT NOT NULL,
    "sequenceId"  TEXT,
    "elementId"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- Investigation — analysis requested from BET or laboratory
CREATE TABLE "Investigation" (
    "id"          TEXT NOT NULL,
    "titre"       TEXT NOT NULL,
    "description" TEXT,
    "bet"         TEXT,
    "statut"      "InvestigationStatus" NOT NULL DEFAULT 'REQUISE',
    "sequenceId"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- Decision — validated heritage decision §6 CDC
CREATE TABLE "Decision" (
    "id"           TEXT NOT NULL,
    "type"         "DecisionType" NOT NULL,
    "description"  TEXT,
    "dateDecision" TIMESTAMP(3),
    "valideeParId" TEXT,
    "sequenceId"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- Intervention — works executed on a sequence §6 CDC
CREATE TABLE "Intervention" (
    "id"               TEXT NOT NULL,
    "entreprise"       TEXT,
    "dateDebut"        TIMESTAMP(3),
    "dateFin"          TIMESTAMP(3),
    "description"      TEXT,
    "quantiteExecutee" TEXT,
    "observationMOE"   TEXT,
    "sequenceId"       TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- Gate — validation checkpoint G0–G5 §12 CDC
CREATE TABLE "Gate" (
    "id"             TEXT NOT NULL,
    "numero"         "GateNumber" NOT NULL,
    "statut"         "GateStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire"    TEXT,
    "dateValidation" TIMESTAMP(3),
    "responsableId"  TEXT,
    "sequenceId"     TEXT,
    "projectId"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- Preuve — link between a heritage entity and a file §7 CDC
CREATE TABLE "Preuve" (
    "id"              TEXT NOT NULL,
    "type"            "EvidenceStatus" NOT NULL,
    "description"     TEXT,
    "fileId"          TEXT NOT NULL,
    "observationId"   TEXT,
    "investigationId" TEXT,
    "decisionId"      TEXT,
    "interventionId"  TEXT,
    "gateId"          TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Preuve_pkey" PRIMARY KEY ("id")
);

-- ─── Unique indexes ───────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "Territoire_code_key" ON "Territoire"("code");
CREATE UNIQUE INDEX "Project_code_key"    ON "Project"("code");
CREATE UNIQUE INDEX "ProjectMember_userId_projectId_key" ON "ProjectMember"("userId", "projectId");
CREATE UNIQUE INDEX "Secteur_code_projectId_key" ON "Secteur"("code", "projectId");
CREATE UNIQUE INDEX "Sequence_code_key"   ON "Sequence"("code");

-- ─── Regular indexes ──────────────────────────────────────────────────────────

CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX "ProjectMember_userId_idx"    ON "ProjectMember"("userId");
CREATE INDEX "Secteur_projectId_idx"       ON "Secteur"("projectId");
CREATE INDEX "Sequence_projectId_idx"      ON "Sequence"("projectId");
CREATE INDEX "Sequence_secteurId_idx"      ON "Sequence"("secteurId");
CREATE INDEX "Element_sequenceId_idx"      ON "Element"("sequenceId");
CREATE INDEX "Observation_sequenceId_idx"  ON "Observation"("sequenceId");
CREATE INDEX "Observation_auteurId_idx"    ON "Observation"("auteurId");
CREATE INDEX "Observation_elementId_idx"   ON "Observation"("elementId");
CREATE INDEX "Investigation_sequenceId_idx" ON "Investigation"("sequenceId");
CREATE INDEX "Decision_sequenceId_idx"     ON "Decision"("sequenceId");
CREATE INDEX "Decision_valideeParId_idx"   ON "Decision"("valideeParId");
CREATE INDEX "Intervention_sequenceId_idx" ON "Intervention"("sequenceId");
CREATE INDEX "Gate_sequenceId_idx"         ON "Gate"("sequenceId");
CREATE INDEX "Gate_projectId_idx"          ON "Gate"("projectId");
CREATE INDEX "Preuve_fileId_idx"           ON "Preuve"("fileId");
CREATE INDEX "Preuve_observationId_idx"    ON "Preuve"("observationId");
CREATE INDEX "Preuve_investigationId_idx"  ON "Preuve"("investigationId");
CREATE INDEX "File_sequenceId_idx"         ON "File"("sequenceId");

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

-- Project → Territoire
ALTER TABLE "Project" ADD CONSTRAINT "Project_territoireId_fkey"
    FOREIGN KEY ("territoireId") REFERENCES "Territoire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProjectMember → User, Project
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Secteur → Project
ALTER TABLE "Secteur" ADD CONSTRAINT "Secteur_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sequence → Project, Secteur
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_secteurId_fkey"
    FOREIGN KEY ("secteurId") REFERENCES "Secteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- File → Sequence (nullable)
ALTER TABLE "File" ADD CONSTRAINT "File_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Element → Sequence (nullable)
ALTER TABLE "Element" ADD CONSTRAINT "Element_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Observation → User, Sequence, Element (nullable)
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_auteurId_fkey"
    FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_elementId_fkey"
    FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Investigation → Sequence (nullable)
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Decision → User (validator, nullable), Sequence (nullable)
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_valideeParId_fkey"
    FOREIGN KEY ("valideeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Intervention → Sequence (nullable)
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Gate → User (nullable), Sequence (nullable), Project (nullable)
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_responsableId_fkey"
    FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preuve → File, Observation, Investigation, Decision, Intervention, Gate (all nullable except file)
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_observationId_fkey"
    FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_investigationId_fkey"
    FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_interventionId_fkey"
    FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_gateId_fkey"
    FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

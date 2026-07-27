-- ==========================================================
-- DOCUCONDUESPOL
-- Schema oficial
-- Compatible con PostgreSQL 13+
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================================
-- TABLA: departments
-- ==========================================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- TABLA: users
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    role TEXT NOT NULL
        CHECK (role IN ('admin','user')),

    department_id UUID NULL,

    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_users_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- ==========================================================
-- TABLA: documents
-- ==========================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL UNIQUE,

    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,

    file_hash TEXT NOT NULL UNIQUE,

    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,

    storage_path TEXT NOT NULL,

    department_id UUID NOT NULL,
    uploaded_by UUID NOT NULL,

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_documents_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_documents_user
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- ==========================================================
-- TABLA: audit_logs
-- ==========================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID,

    action TEXT NOT NULL,

    username TEXT NOT NULL,

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- ==========================================================
-- ÍNDICES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_documents_code
ON documents(code);

CREATE INDEX IF NOT EXISTS idx_documents_department
ON documents(department_id);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at
ON documents(uploaded_at);

CREATE INDEX IF NOT EXISTS idx_documents_original_name
ON documents
USING GIN (
    to_tsvector('spanish', original_name)
);

CREATE INDEX IF NOT EXISTS idx_users_username
ON users(username);

CREATE INDEX IF NOT EXISTS idx_departments_code
ON departments(code);

-- ==========================================================
-- DEPARTAMENTOS INICIALES
-- ==========================================================

INSERT INTO departments (name, code)
VALUES
('Secretaria General','SG'),
('Activos Fijos','AF'),
('Educacion Continua','EC'),
('TICS','TI'),
('Comercio','CO'),
('CallCenter','CC')
ON CONFLICT (code) DO NOTHING;

-- ==========================================================
-- FIN DEL SCHEMA
-- ==========================================================
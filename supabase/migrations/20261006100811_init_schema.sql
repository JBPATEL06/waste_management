-- ============================================================================
-- Migration: 20261006100811_init_schema.sql
-- Description: Core schema, enums, tables, constraints, indexes, triggers, and RLS
-- Source of Truth: data_dictionary_and_auth.md Part A
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Custom Enums
CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'COLLECTION',
  'TRANSPORTATION',
  'RTS',
  'PROCESSING',
  'HEAD_OFFICER'
);

CREATE TYPE waste_type AS ENUM (
  'WET',
  'DRY'
);

CREATE TYPE stage_type AS ENUM (
  'COLLECTION',
  'TRANSPORTATION',
  'RTS',
  'PROCESSING'
);

CREATE TYPE entry_status AS ENUM (
  'ACTIVE',
  'SUPERSEDED',
  'DELETED'
);

CREATE TYPE batch_status AS ENUM (
  'CREATED',
  'COLLECTED',
  'IN_TRANSIT',
  'AT_RTS',
  'COMPLETED'
);

CREATE TYPE final_status AS ENUM (
  'PROCESSED',
  'RECOVERED',
  'DISPOSED',
  'COMPLETED'
);

CREATE TYPE audit_action AS ENUM (
  'BATCH_CREATE',
  'BATCH_EDIT',
  'ASSIGN',
  'REASSIGN',
  'ENTRY_CREATE',
  'ENTRY_CORRECT',
  'ENTRY_ADMIN_EDIT',
  'ENTRY_ADMIN_DELETE',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DEACTIVATE',
  'PASSWORD_RESET',
  'MASTER_CHANGE'
);

-- 3. Utility Functions & Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence & Helper for public Batch ID format WB-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS batch_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_batch_code()
RETURNS text AS $$
DECLARE
    next_val bigint;
    year_str text;
BEGIN
    next_val := nextval('batch_code_seq');
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'WB-' || year_str || '-' || lpad(next_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. Access & Auth Tables

-- 4.1 users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_login_count int NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  last_login_at timestamptz NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role_is_active ON users (role, is_active);

-- 4.2 refresh_tokens
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  family_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  user_agent text NULL,
  ip_address inet NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- 5. Master Data Tables

-- 5.1 routes
CREATE TABLE routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.2 vehicles
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text NULL,
  capacity_kg numeric(10,2) NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.3 rts_locations
CREATE TABLE rts_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.4 processing_facilities
CREATE TABLE processing_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.5 process_types
CREATE TABLE process_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.6 waste_categories
CREATE TABLE waste_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.7 drivers
CREATE TABLE drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NULL,
  designation text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Core Tables

-- 6.1 batches
CREATE TABLE batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL UNIQUE,
  batch_date date NOT NULL,
  waste_type waste_type NOT NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  source_area text NOT NULL,
  route_id uuid NOT NULL REFERENCES routes(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  initial_status batch_status NOT NULL DEFAULT 'CREATED',
  current_status batch_status NOT NULL DEFAULT 'CREATED',
  current_stage stage_type NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_batches_current_status ON batches (current_status);
CREATE INDEX idx_batches_batch_date ON batches (batch_date);
CREATE INDEX idx_batches_route_id ON batches (route_id);
CREATE INDEX idx_batches_vehicle_id ON batches (vehicle_id);
CREATE INDEX idx_batches_waste_type ON batches (waste_type);

-- 6.2 batch_assignments
CREATE TABLE batch_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  stage stage_type NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX idx_batch_assignments_active ON batch_assignments (batch_id, stage) WHERE is_active = true;
CREATE INDEX idx_batch_assignments_user_active ON batch_assignments (user_id, is_active);

-- 6.3 stage_entries
CREATE TABLE stage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  stage stage_type NOT NULL,
  version_no int NOT NULL DEFAULT 1,
  status entry_status NOT NULL DEFAULT 'ACTIVE',
  supersedes_id uuid NULL REFERENCES stage_entries(id),
  event_time timestamptz NOT NULL,
  display_location text NOT NULL,
  note text NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid NULL REFERENCES users(id),
  deleted_at timestamptz NULL,
  delete_reason text NULL
);

CREATE UNIQUE INDEX idx_stage_entries_active ON stage_entries (batch_id, stage) WHERE status = 'ACTIVE';
CREATE INDEX idx_stage_entries_lookup ON stage_entries (batch_id, stage, status);
CREATE INDEX idx_stage_entries_created_by ON stage_entries (created_by);
CREATE INDEX idx_stage_entries_event_time ON stage_entries (event_time);

-- 6.4 collection_details
CREATE TABLE collection_details (
  entry_id uuid PRIMARY KEY REFERENCES stage_entries(id) ON DELETE CASCADE,
  collection_area text NOT NULL,
  route_id uuid NOT NULL REFERENCES routes(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  waste_type waste_type NOT NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  driver_id uuid NOT NULL REFERENCES drivers(id),
  segregation_grade text NULL
);

-- 6.5 transportation_details
CREATE TABLE transportation_details (
  entry_id uuid PRIMARY KEY REFERENCES stage_entries(id) ON DELETE CASCADE,
  start_location text NOT NULL,
  destination text NOT NULL,
  rts_location_id uuid NOT NULL REFERENCES rts_locations(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  departure_time timestamptz NOT NULL,
  arrival_time timestamptz NULL,
  duration_minutes int GENERATED ALWAYS AS (
    CASE 
      WHEN arrival_time IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (arrival_time - departure_time)) / 60)::int 
      ELSE NULL 
    END
  ) STORED,
  CONSTRAINT chk_transport_arrival CHECK (arrival_time IS NULL OR arrival_time >= departure_time)
);

-- 6.6 rts_details
CREATE TABLE rts_details (
  entry_id uuid PRIMARY KEY REFERENCES stage_entries(id) ON DELETE CASCADE,
  rts_location_id uuid NOT NULL REFERENCES rts_locations(id),
  quantity_received numeric(12,2) NOT NULL CHECK (quantity_received > 0),
  waste_category_id uuid NOT NULL REFERENCES waste_categories(id),
  handover_details text NOT NULL,
  next_facility_id uuid NOT NULL REFERENCES processing_facilities(id),
  variance_pct numeric(6,2) NULL,
  is_flagged boolean NOT NULL DEFAULT false
);

-- 6.7 processing_details
CREATE TABLE processing_details (
  entry_id uuid PRIMARY KEY REFERENCES stage_entries(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES processing_facilities(id),
  process_type_id uuid NOT NULL REFERENCES process_types(id),
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  final_status final_status NOT NULL
);

-- 6.8 audit_log
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  action audit_action NOT NULL,
  batch_id uuid NULL REFERENCES batches(id) ON DELETE SET NULL,
  entry_id uuid NULL REFERENCES stage_entries(id) ON DELETE SET NULL,
  entity_type text NULL,
  entity_id uuid NULL,
  old_values jsonb NULL,
  new_values jsonb NULL,
  reason text NULL,
  performed_by uuid NOT NULL REFERENCES users(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_batch_time ON audit_log (batch_id, performed_at);
CREATE INDEX idx_audit_log_performed_by ON audit_log (performed_by);
CREATE INDEX idx_audit_log_action ON audit_log (action);

-- 6.9 app_settings
CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Attach updated_at Triggers
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_rts_locations_updated_at BEFORE UPDATE ON rts_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_processing_facilities_updated_at BEFORE UPDATE ON processing_facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_process_types_updated_at BEFORE UPDATE ON process_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_waste_categories_updated_at BEFORE UPDATE ON waste_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Enable Row Level Security (RLS) on ALL tables with NO policies
-- (Backend connects with service/postgres role; frontend never connects directly)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rts_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE rts_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;


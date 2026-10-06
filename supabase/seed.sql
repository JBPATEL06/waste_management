-- ============================================================================
-- Seed Data: supabase/seed.sql
-- Description: Initial 6 role users, master data, and app settings
-- ============================================================================

-- 1. App Settings
INSERT INTO app_settings (key, value)
VALUES ('variance_threshold_pct', '10')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Process Types (Seed exactly as specified: Composting, Recovery, Electricity Generation, Disposal)
INSERT INTO process_types (name, is_active) VALUES
  ('Composting', true),
  ('Recovery', true),
  ('Electricity Generation', true),
  ('Disposal', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Waste Categories (Organic, Plastic, Paper, Mixed)
INSERT INTO waste_categories (name, is_active) VALUES
  ('Organic', true),
  ('Plastic', true),
  ('Paper', true),
  ('Mixed', true)
ON CONFLICT (name) DO NOTHING;

-- 4. Routes (3 routes)
INSERT INTO routes (code, name, description, is_active) VALUES
  ('R-01', 'Route 01 - City Central', 'Core commercial loop connecting Market Street and CBD', true),
  ('R-02', 'Route 02 - North Corridor', 'Residential wards and secondary collection points in Sector 14-22', true),
  ('R-03', 'Route 03 - Outer Ring East', 'High-density transit artery servicing industrial cluster 9', true)
ON CONFLICT (code) DO NOTHING;

-- 5. Vehicles (3 vehicles)
INSERT INTO vehicles (vehicle_number, vehicle_type, capacity_kg, is_active) VALUES
  ('KA-01-EA-1042', 'Compactor Truck (5T)', 5000.00, true),
  ('KA-04-TR-9921', 'Heavy Multi-Axle Tipper (10T)', 10000.00, true),
  ('DL-01-EA-4821', 'Standard Tipper (3.5T)', 3500.00, true)
ON CONFLICT (vehicle_number) DO NOTHING;

-- 6. RTS Locations (2 RTS locations)
INSERT INTO rts_locations (name, location, is_active) VALUES
  ('Central Transfer Station A', 'Sector 4 Industrial Hub, Mid-Town Gate 1', true),
  ('East Peripheral RTS Hub', 'Plot 88, Outer Ring Corridor, Ward 22', true)
ON CONFLICT (name) DO NOTHING;

-- 7. Processing Facilities (2 facilities)
INSERT INTO processing_facilities (name, location, is_active) VALUES
  ('Apex Bio-Methanization Plant', 'Eco-Zone 3, Northern Renewable Energy Park', true),
  ('Materials Recovery Facility (MRF Dry)', 'Greenfield Recycling Enclave, South Sector', true)
ON CONFLICT (name) DO NOTHING;

-- 8. Drivers / Supervisors (3 drivers)
INSERT INTO drivers (name, phone, designation, is_active) VALUES
  ('Ramesh Kumar', '+91 98765 43210', 'Driver', true),
  ('Mahesh Singh', '+91 98765 43211', 'Driver', true),
  ('Dinesh Yadav', '+91 98765 43212', 'Supervisor', true);

-- 9. Users (6 users, 1 per role, bcrypt cost 12 hashed temp passwords, must_change_password = true)
-- NOTE: For local development only. In production, use scripts/seed-production-users.js
INSERT INTO users (name, email, password_hash, role, is_active, must_change_password) VALUES
  ('Anil Mehta', 'admin@wastejourney.local', crypt(coalesce(nullif(current_setting('app.seed_password', true), ''), 'ChangeMe123!@#'), gen_salt('bf', 12)), 'ADMIN', true, true),
  ('Rajesh Sharma', 'collection@wastejourney.local', crypt(coalesce(nullif(current_setting('app.seed_password', true), ''), 'ChangeMe123!@#'), gen_salt('bf', 12)), 'COLLECTION', true, true),
  ('Suresh Patil', 'transport@wastejourney.local', crypt(coalesce(nullif(current_setting('app.seed_password', true), ''), 'ChangeMe123!@#'), gen_salt('bf', 12)), 'TRANSPORTATION', true, true),
  ('Vikram Desai', 'rts@wastejourney.local', crypt(coalesce(nullif(current_setting('app.seed_password', true), ''), 'ChangeMe123!@#'), gen_salt('bf', 12)), 'RTS', true, true),
  ('Anita Roy', 'processing@wastejourney.local', crypt(coalesce(nullif(current_setting('app.seed_password', true), ''), 'ChangeMe123!@#'), gen_salt('bf', 12)), 'PROCESSING', true, true),
  ('Dr. K. S. Verma', 'headofficer@wastejourney.local', crypt(coalesce(nullif(current_setting('app.seed_password', true), ''), 'ChangeMe123!@#'), gen_salt('bf', 12)), 'HEAD_OFFICER', true, true)
ON CONFLICT (email) DO NOTHING;


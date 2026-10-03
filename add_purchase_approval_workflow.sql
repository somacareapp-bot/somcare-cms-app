-- Pharmacy purchases
CREATE TYPE purchases_approval_status_enum AS ENUM ('submitted', 'admin_approved', 'admin_rejected', 'paid');
ALTER TABLE purchases
  ADD COLUMN approval_status purchases_approval_status_enum NOT NULL DEFAULT 'submitted',
  ADD COLUMN submitted_by_id varchar NULL,
  ADD COLUMN submitted_by_name varchar NULL,
  ADD COLUMN reviewed_by_id varchar NULL,
  ADD COLUMN reviewed_by_name varchar NULL,
  ADD COLUMN reviewed_at timestamptz NULL,
  ADD COLUMN rejection_reason text NULL,
  ADD COLUMN paid_by_id varchar NULL,
  ADD COLUMN paid_by_name varchar NULL,
  ADD COLUMN paid_at timestamptz NULL;

-- Backfill existing rows sensibly: already-confirmed/paid purchases are
-- treated as already approved so they don't get stuck in a review queue.
UPDATE purchases SET approval_status = 'admin_approved' WHERE status = 'confirmed';

-- Lab supply purchases
CREATE TYPE lab_supply_purchases_approval_status_enum AS ENUM ('submitted', 'admin_approved', 'admin_rejected', 'paid');
ALTER TABLE lab_supply_purchases
  ADD COLUMN approval_status lab_supply_purchases_approval_status_enum NOT NULL DEFAULT 'submitted',
  ADD COLUMN submitted_by_id varchar NULL,
  ADD COLUMN submitted_by_name varchar NULL,
  ADD COLUMN reviewed_by_id varchar NULL,
  ADD COLUMN reviewed_by_name varchar NULL,
  ADD COLUMN reviewed_at timestamptz NULL,
  ADD COLUMN rejection_reason text NULL,
  ADD COLUMN paid_by_id varchar NULL,
  ADD COLUMN paid_by_name varchar NULL,
  ADD COLUMN paid_at timestamptz NULL;

UPDATE lab_supply_purchases SET approval_status = 'admin_approved' WHERE status = 'confirmed';

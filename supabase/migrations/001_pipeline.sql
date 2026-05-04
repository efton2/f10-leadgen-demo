-- Pipeline leads: saved when Efton clicks into a lead detail page
CREATE TABLE IF NOT EXISTS pipeline_leads (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id      TEXT        UNIQUE NOT NULL,
  business_name TEXT        NOT NULL,
  address       TEXT        DEFAULT '',
  phone         TEXT        DEFAULT '',
  rating        NUMERIC     DEFAULT 0,
  review_count  INTEGER     DEFAULT 0,
  category      TEXT        DEFAULT '',
  city          TEXT        DEFAULT '',
  status        TEXT        DEFAULT 'new' NOT NULL
                            CHECK (status IN ('new','reviewed','demoed','proposal_sent','closed','active','recurring')),
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Clients: created when a pipeline lead is marked closed
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id             UUID        REFERENCES pipeline_leads(id) ON DELETE SET NULL,
  business_name       TEXT        NOT NULL,
  contact_name        TEXT        DEFAULT '',
  contact_email       TEXT        DEFAULT '',
  contact_phone       TEXT        DEFAULT '',
  sku                 TEXT        DEFAULT 'dfy' NOT NULL
                                  CHECK (sku IN ('dfy','dwy')),
  payment_status      TEXT        DEFAULT 'pending' NOT NULL
                                  CHECK (payment_status IN ('pending','active','paused','cancelled')),
  provisioning_status TEXT        DEFAULT 'not_started' NOT NULL
                                  CHECK (provisioning_status IN ('not_started','in_progress','live')),
  go_live_date        DATE,
  notes               TEXT        DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on pipeline_leads
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_leads_updated_at
  BEFORE UPDATE ON pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

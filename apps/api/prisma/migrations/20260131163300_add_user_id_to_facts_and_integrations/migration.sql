-- Add user_id to Facts and Integrations

-- 1. Create default user if not exists
INSERT INTO factrail.users (id, email, name, status, is_email_verified, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default@factrail.local',
  'Default User (Migration)',
  'active',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- 2. Add user_id column to facts table (nullable)
ALTER TABLE factrail.facts ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 3. Set default user for existing facts
UPDATE factrail.facts
SET user_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id IS NULL;

-- 4. Add NOT NULL constraint to facts.user_id
ALTER TABLE factrail.facts ALTER COLUMN user_id SET NOT NULL;

-- 5. Add foreign key constraint to facts
DO $$ BEGIN
  ALTER TABLE factrail.facts ADD CONSTRAINT facts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES factrail.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. Add index on facts.user_id
CREATE INDEX IF NOT EXISTS facts_user_id_idx ON factrail.facts(user_id);

-- 7. Add user_id column to integrations table (nullable)
ALTER TABLE factrail.integrations ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 8. Set default user for existing integrations
UPDATE factrail.integrations
SET user_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id IS NULL;

-- 9. Add NOT NULL constraint to integrations.user_id
ALTER TABLE factrail.integrations ALTER COLUMN user_id SET NOT NULL;

-- 10. Add foreign key constraint to integrations
DO $$ BEGIN
  ALTER TABLE factrail.integrations ADD CONSTRAINT integrations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES factrail.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 11. Add index on integrations.user_id
CREATE INDEX IF NOT EXISTS integrations_user_id_idx ON factrail.integrations(user_id);

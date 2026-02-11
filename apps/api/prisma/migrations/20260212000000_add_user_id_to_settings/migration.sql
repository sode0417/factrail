-- Add user_id to Settings for multi-user support

-- 1. Add user_id column (nullable)
ALTER TABLE factrail.settings ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. Add foreign key constraint
DO $$ BEGIN
  ALTER TABLE factrail.settings ADD CONSTRAINT settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES factrail.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Drop old unique constraint (provider, setting_type)
ALTER TABLE factrail.settings DROP CONSTRAINT IF EXISTS settings_provider_setting_type_key;

-- 4. Add new unique constraint (user_id, provider, setting_type)
ALTER TABLE factrail.settings ADD CONSTRAINT settings_user_id_provider_setting_type_key
  UNIQUE (user_id, provider, setting_type);

-- Migrate global settings (user_id=NULL) to the correct user
-- Settings were incorrectly saved without user_id due to controller bug

-- Strategy:
-- 1. For each provider, find the user who has an integration for that provider
-- 2. Assign the global settings to that user
-- 3. If no matching integration exists, assign to the oldest user as fallback

-- Step 1: Assign settings to users who have matching integrations
UPDATE factrail.settings s
SET user_id = i.user_id
FROM factrail.integrations i
WHERE s.user_id IS NULL
  AND s.provider = i.provider
  AND i.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM factrail.settings s2
    WHERE s2.user_id = i.user_id
      AND s2.provider = s.provider
      AND s2.setting_type = s.setting_type
  );

-- Step 2: For remaining global settings with no matching integration,
-- assign to the oldest user (fallback)
UPDATE factrail.settings s
SET user_id = (
  SELECT id FROM factrail.users ORDER BY created_at ASC LIMIT 1
)
WHERE s.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM factrail.settings s2
    WHERE s2.user_id = (SELECT id FROM factrail.users ORDER BY created_at ASC LIMIT 1)
      AND s2.provider = s.provider
      AND s2.setting_type = s.setting_type
  );

-- Step 3: Delete any remaining orphaned global settings that would cause
-- unique constraint violations (already have a user-specific version)
DELETE FROM factrail.settings WHERE user_id IS NULL;

-- ユーザーIDをFactsとIntegrationsに追加するマイグレーション

-- 1. デフォルトユーザーを作成（存在しない場合）
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

-- 2. Factテーブルにuser_idカラムを追加（NULL許可）
ALTER TABLE factrail.facts ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 3. 既存のFactsをデフォルトユーザーに紐付け
UPDATE factrail.facts
SET user_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id IS NULL;

-- 4. NOT NULL制約を追加
ALTER TABLE factrail.facts ALTER COLUMN user_id SET NOT NULL;

-- 5. 外部キー制約を追加
ALTER TABLE factrail.facts ADD CONSTRAINT IF NOT EXISTS facts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES factrail.users(id) ON DELETE CASCADE;

-- 6. インデックスを追加
CREATE INDEX IF NOT EXISTS facts_user_id_idx ON factrail.facts(user_id);

-- 7. Integrationテーブルにuser_idカラムを追加（NULL許可）
ALTER TABLE factrail.integrations ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 8. 既存のIntegrationsをデフォルトユーザーに紐付け
UPDATE factrail.integrations
SET user_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id IS NULL;

-- 9. NOT NULL制約を追加
ALTER TABLE factrail.integrations ALTER COLUMN user_id SET NOT NULL;

-- 10. 外部キー制約を追加
ALTER TABLE factrail.integrations ADD CONSTRAINT IF NOT EXISTS integrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES factrail.users(id) ON DELETE CASCADE;

-- 11. インデックスを追加
CREATE INDEX IF NOT EXISTS integrations_user_id_idx ON factrail.integrations(user_id);

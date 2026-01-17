-- Settings テーブルを作成
CREATE TABLE IF NOT EXISTS factrail.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(255) NOT NULL,
  setting_type VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT settings_provider_setting_type_key UNIQUE (provider, setting_type)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_settings_provider ON factrail.settings(provider);

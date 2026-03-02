-- CreateTable
CREATE TABLE IF NOT EXISTS factrail.repositories (
    id TEXT NOT NULL,
    integration_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active',
    last_event_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT repositories_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS repositories_integration_id_full_name_key ON factrail.repositories(integration_id, full_name);

-- CreateIndex
CREATE INDEX IF NOT EXISTS repositories_full_name_idx ON factrail.repositories(full_name);

-- CreateIndex
CREATE INDEX IF NOT EXISTS repositories_owner_idx ON factrail.repositories(owner);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE factrail.repositories ADD CONSTRAINT repositories_integration_id_fkey
    FOREIGN KEY (integration_id) REFERENCES factrail.integrations(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

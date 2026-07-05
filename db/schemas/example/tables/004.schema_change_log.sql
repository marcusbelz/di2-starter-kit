\echo "## CREATE TABLE :schema_app.schema_change_log"

-- Run-once tracker from .claude/rules/db-migrations.md: one append-only row per
-- applied predeploy/postdeploy transition script, written by db/scripts/deploy.sh
-- via sp_ins_schema_change. filename is the run-once key (a file executes exactly
-- once per database); checksum enforces immutability — the runner aborts when an
-- applied file's checksum changes. Sibling of schema_apply_log (003).
--
-- Deliberately EXEMPT from the audit-column/trigger convention: the table is
-- append-only (never updated), and the deploy actor IS the connection role
-- (schema owner), so applied_by DEFAULT current_user is correct here — unlike
-- domain tables, where audit columns carry the app user's email.

CREATE TABLE IF NOT EXISTS :schema_app.schema_change_log
(
    id            bigint        NOT NULL GENERATED ALWAYS AS IDENTITY
   ,filename      varchar(200)  NOT NULL
   ,checksum      varchar(64)   NOT NULL
   ,git_sha       varchar(64)   NOT NULL
   ,applied_on    timestamptz   NOT NULL DEFAULT now()
   ,applied_by    varchar(100)  NOT NULL DEFAULT current_user

   ,CONSTRAINT pk_schema_change_log  PRIMARY KEY (id)

   ,CONSTRAINT chk_schema_change_log_filename  CHECK (length(trim(filename)) > 0)
   ,CONSTRAINT chk_schema_change_log_checksum  CHECK (length(trim(checksum)) > 0)
   ,CONSTRAINT chk_schema_change_log_git_sha   CHECK (length(trim(git_sha)) > 0)
);
ALTER TABLE :schema_app.schema_change_log OWNER TO :schema_owner;

-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_app.schema_change_log DROP CONSTRAINT IF EXISTS uq_schema_change_log_filename;
ALTER TABLE :schema_app.schema_change_log ADD  CONSTRAINT uq_schema_change_log_filename UNIQUE (filename);

-- --------------------------------------------------------------------------------
-- Comments
-- --------------------------------------------------------------------------------
COMMENT ON TABLE  :schema_app.schema_change_log             IS 'Append-only run-once tracker: one row per applied predeploy/postdeploy transition script (see .claude/rules/db-migrations.md).';

COMMENT ON COLUMN :schema_app.schema_change_log.filename    IS 'Run-once key (UNIQUE): schema dir + section + file name, e.g. example/postdeploy/202607050900.backfill-example-notes.sql.';
COMMENT ON COLUMN :schema_app.schema_change_log.checksum    IS 'sha256 (hex) of the file at apply time; the runner aborts when an applied file''s checksum changes (immutability guard).';
COMMENT ON COLUMN :schema_app.schema_change_log.git_sha     IS 'Git commit SHA the apply run was executed from (''unknown'' outside a git checkout).';
COMMENT ON COLUMN :schema_app.schema_change_log.applied_on  IS 'Timestamp of the apply.';
COMMENT ON COLUMN :schema_app.schema_change_log.applied_by  IS 'Connection role that ran the apply (the schema owner — deploy actor, not an app user).';

\echo "## CREATE TABLE :schema_app.schema_change_log - DONE"

\echo "## CREATE TABLE :schema_app.schema_apply_log"

-- Deploy tracker from .claude/rules/db-migrations.md: one append-only row per apply
-- run, written by db/scripts/deploy.sh via sp_ins_schema_apply. The most recent row
-- is the current schema state of the environment.
--
-- Deliberately EXEMPT from the audit-column/trigger convention: the table is
-- append-only (never updated), and the deploy actor IS the connection role
-- (schema owner), so applied_by DEFAULT current_user is correct here — unlike
-- domain tables, where audit columns carry the app user's email.

CREATE TABLE IF NOT EXISTS :schema_app.schema_apply_log
(
    id            bigint        NOT NULL GENERATED ALWAYS AS IDENTITY
   ,db_version    varchar(50)   NOT NULL
   ,git_sha       varchar(64)   NOT NULL
   ,environment   varchar(10)   NOT NULL
   ,note          varchar(500)      NULL
   ,applied_on    timestamptz   NOT NULL DEFAULT now()
   ,applied_by    varchar(100)  NOT NULL DEFAULT current_user

   ,CONSTRAINT pk_schema_apply_log  PRIMARY KEY (id)

   ,CONSTRAINT chk_schema_apply_log_db_version  CHECK (length(trim(db_version)) > 0)
   ,CONSTRAINT chk_schema_apply_log_git_sha     CHECK (length(trim(git_sha)) > 0)
);
ALTER TABLE :schema_app.schema_apply_log OWNER TO :schema_owner;

-- --------------------------------------------------------------------------------
-- Comments
-- --------------------------------------------------------------------------------
COMMENT ON TABLE  :schema_app.schema_apply_log              IS 'Append-only deploy history: one row per schema apply run (see .claude/rules/db-migrations.md).';

COMMENT ON COLUMN :schema_app.schema_apply_log.db_version   IS 'Version label passed by the deploy script (e.g. 1.0.42).';
COMMENT ON COLUMN :schema_app.schema_apply_log.git_sha      IS 'Git commit SHA the apply run was executed from.';
COMMENT ON COLUMN :schema_app.schema_apply_log.environment  IS 'Target environment of the apply run (e.g. local/dev/int/test/prod).';
COMMENT ON COLUMN :schema_app.schema_apply_log.note         IS 'Optional free-text note (e.g. "initial bootstrap").';
COMMENT ON COLUMN :schema_app.schema_apply_log.applied_on   IS 'Timestamp of the apply run.';
COMMENT ON COLUMN :schema_app.schema_apply_log.applied_by   IS 'Connection role that ran the apply (the schema owner — deploy actor, not an app user).';

\echo "## CREATE TABLE :schema_app.schema_apply_log - DONE"

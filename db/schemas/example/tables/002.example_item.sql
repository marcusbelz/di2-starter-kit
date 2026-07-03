\echo "## CREATE TABLE :schema_app.example_item"

-- Child table of app.example: demonstrates the FK convention (separate ALTER TABLE,
-- deliberate ON DELETE behavior — here the default RESTRICT, so sp_del_example shows
-- the speaking reference-guard pattern instead of a silent cascade).

CREATE TABLE IF NOT EXISTS :schema_app.example_item
(
    id            bigint        NOT NULL GENERATED ALWAYS AS IDENTITY
   ,example_id    bigint        NOT NULL
   ,label         varchar(200)  NOT NULL
   ,sort_order    int           NOT NULL DEFAULT 0

   ,created_on    timestamptz   NOT NULL DEFAULT now()
   ,created_by    varchar(100)  NOT NULL
   ,modified_on   timestamptz       NULL
   ,modified_by   varchar(100)      NULL

   ,CONSTRAINT pk_example_item  PRIMARY KEY (id)

   ,CONSTRAINT chk_example_item_label  CHECK (length(trim(label)) > 0)
);
ALTER TABLE :schema_app.example_item OWNER TO :schema_owner;

-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_app.example_item DROP CONSTRAINT IF EXISTS uq_example_item_example_id_label;
ALTER TABLE :schema_app.example_item ADD  CONSTRAINT uq_example_item_example_id_label UNIQUE (example_id, label);

-- --------------------------------------------------------------------------------
-- Foreign keys
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_app.example_item DROP CONSTRAINT IF EXISTS fk_example_item_example_id;
ALTER TABLE :schema_app.example_item ADD  CONSTRAINT fk_example_item_example_id FOREIGN KEY (example_id) REFERENCES :schema_app.example(id);

CREATE INDEX IF NOT EXISTS ix_example_item_example_id ON :schema_app.example_item (example_id);

-- --------------------------------------------------------------------------------
-- Comments
-- --------------------------------------------------------------------------------
COMMENT ON TABLE  :schema_app.example_item             IS 'Detail rows of app.example — worked example for the FK / reference-guard conventions.';

COMMENT ON COLUMN :schema_app.example_item.example_id  IS 'Parent row in app.example (FK, RESTRICT — deletes are guarded in sp_del_example).';
COMMENT ON COLUMN :schema_app.example_item.label       IS 'Item label (non-empty; UNIQUE per parent).';
COMMENT ON COLUMN :schema_app.example_item.sort_order  IS 'Display/sort position within the parent (0-based).';

\echo "## CREATE TABLE :schema_app.example_item - DONE"

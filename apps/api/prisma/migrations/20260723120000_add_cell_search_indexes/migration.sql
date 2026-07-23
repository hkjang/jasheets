CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "cells"
ADD COLUMN "valueSearchText" TEXT;

UPDATE "cells"
SET "valueSearchText" = CASE
  WHEN value IS NULL OR value = 'null'::jsonb THEN NULL
  ELSE value::text
END;

CREATE OR REPLACE FUNCTION jasheets_sync_cell_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."valueSearchText" := CASE
    WHEN NEW.value IS NULL OR NEW.value = 'null'::jsonb THEN NULL
    ELSE NEW.value::text
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cells_sync_search_text
BEFORE INSERT OR UPDATE OF value ON "cells"
FOR EACH ROW
EXECUTE FUNCTION jasheets_sync_cell_search_text();

CREATE INDEX "cells_valueSearchText_trgm_idx"
ON "cells" USING GIN (lower("valueSearchText") gin_trgm_ops)
WHERE "valueSearchText" IS NOT NULL;

CREATE INDEX "cells_formula_trgm_idx"
ON "cells" USING GIN (lower(formula) gin_trgm_ops)
WHERE formula IS NOT NULL;

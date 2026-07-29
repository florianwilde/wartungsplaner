-- Revisionssicherheit: Das Audit-Log ist "append only".
-- Einträge dürfen ausschließlich eingefügt werden. UPDATE und DELETE werden
-- auf Datenbankebene blockiert, damit auch ein direkter Zugriff über psql
-- die Historie nicht verfälschen kann.

CREATE OR REPLACE FUNCTION audit_log_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'AuditLog ist revisionssicher: % ist nicht zulaessig (nur INSERT)', TG_OP
    USING ERRCODE = '0A000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

DROP TRIGGER IF EXISTS audit_log_no_delete ON "AuditLog";
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

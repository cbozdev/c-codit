<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::unprepared(<<<'SQL'
                CREATE OR REPLACE FUNCTION assert_journal_balanced()
                RETURNS trigger AS $$
                DECLARE
                    total_debit bigint;
                    total_credit bigint;
                BEGIN
                    SELECT
                        COALESCE(SUM(CASE WHEN direction='debit'  THEN amount_minor ELSE 0 END), 0),
                        COALESCE(SUM(CASE WHEN direction='credit' THEN amount_minor ELSE 0 END), 0)
                    INTO total_debit, total_credit
                    FROM ledger_entries
                    WHERE journal_id = COALESCE(NEW.journal_id, OLD.journal_id);

                    IF total_debit <> total_credit THEN
                        RAISE EXCEPTION
                            'Unbalanced journal %: debits=% credits=%',
                            COALESCE(NEW.journal_id, OLD.journal_id), total_debit, total_credit;
                    END IF;

                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;

                CREATE CONSTRAINT TRIGGER ledger_entries_balance_check
                AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced();

                CREATE OR REPLACE FUNCTION forbid_ledger_mutation()
                RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'ledger_entries is append-only; % is forbidden', TG_OP;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER ledger_entries_no_update
                BEFORE UPDATE ON ledger_entries
                FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

                CREATE TRIGGER ledger_entries_no_delete
                BEFORE DELETE ON ledger_entries
                FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
            SQL);
        } elseif ($driver === 'mysql') {
            // MySQL: immutability triggers (append-only enforcement)
            // Balance check is enforced at application level via LedgerService
            DB::unprepared('
                CREATE TRIGGER ledger_entries_no_update
                BEFORE UPDATE ON ledger_entries
                FOR EACH ROW
                BEGIN
                    SIGNAL SQLSTATE \'45000\'
                    SET MESSAGE_TEXT = \'ledger_entries is append-only; UPDATE is forbidden\';
                END
            ');
            DB::unprepared('
                CREATE TRIGGER ledger_entries_no_delete
                BEFORE DELETE ON ledger_entries
                FOR EACH ROW
                BEGIN
                    SIGNAL SQLSTATE \'45000\'
                    SET MESSAGE_TEXT = \'ledger_entries is append-only; DELETE is forbidden\';
                END
            ');
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS ledger_entries_no_delete ON ledger_entries;
                DROP TRIGGER IF EXISTS ledger_entries_no_update ON ledger_entries;
                DROP TRIGGER IF EXISTS ledger_entries_balance_check ON ledger_entries;
                DROP FUNCTION IF EXISTS forbid_ledger_mutation();
                DROP FUNCTION IF EXISTS assert_journal_balanced();
            SQL);
        } elseif ($driver === 'mysql') {
            DB::unprepared('DROP TRIGGER IF EXISTS ledger_entries_no_update');
            DB::unprepared('DROP TRIGGER IF EXISTS ledger_entries_no_delete');
        }
    }
};

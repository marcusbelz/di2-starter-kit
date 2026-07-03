-- 07 — Service account receives the RW group role (inherits DML rights via INHERIT).
-- Run against the NEW database, connected as a superuser.

\echo '## 07 grant rw role to service account'

GRANT :role_rw TO :user_sa;

\echo '## 07 grant rw role to service account - DONE'

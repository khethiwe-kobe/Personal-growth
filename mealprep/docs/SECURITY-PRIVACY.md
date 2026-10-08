# Security & privacy (POPIA)

Health and nutrition information is **special personal information**. The
platform is designed so that it is collected with explicit consent, used only
for meal planning, restricted by role, auditable and deletable.

## Controls implemented

| Area | Implementation |
|---|---|
| Authentication | scrypt-hashed passwords, 256-bit opaque session tokens stored as SHA-256, httpOnly/SameSite cookies, 14-day expiry (`lib/auth.ts`) |
| Authorisation | Role → permission matrix (`PERMISSIONS`), enforced in every server action (`assertPermission`) and layout (`requirePermission`); clients can only reach their own rows via `requireClient()` and ownership checks in actions |
| Audit log | `audit_log` written on create/update/status/payment/inventory/anonymise actions with the acting user (`/audit`) |
| Consent | `client_consents` records type, version, granted flag and timestamp; onboarding requires data-processing, health-data and terms consent; marketing is optional |
| Data subject rights | JSON export of every record (`/api/export/client/:id`); anonymise-and-delete that removes personal/health data while keeping financial records (`anonymiseClient`) |
| Minimisation | Blood type is stored but never used; medical free text is optional; photo/proof blobs excluded from exports |
| Encryption | Transport: deploy behind TLS. At rest: SQLite file permissions / disk encryption, or SQLCipher; `lib/crypto.ts` offers AES-256-GCM field encryption when `MEALPREP_FIELD_KEY` is set |
| Backups | Copy `data/mealprep.db` (WAL mode: use `sqlite3 .backup` or stop the process) nightly to encrypted storage; with Postgres use managed point-in-time recovery |
| Secrets | `MEALPREP_SESSION_SECRET`, `MEALPREP_WEBHOOK_SECRET`, `MEALPREP_FIELD_KEY` via environment only |
| Webhooks | Outbound events carry `x-mealprep-secret`; inbound payment webhooks should verify the gateway signature before calling `recordPayment` |

## Operational checklist

- Appoint and register an Information Officer (Information Regulator).
- Publish a privacy policy covering: what is collected, purpose, retention,
  third parties (delivery, messaging, payment), rights and contact.
- Retention: delete churned clients' health data after an agreed period
  (the anonymise action), keep financial records as required by tax law.
- Staff accounts: one per person, least-privilege role, deactivate on exit.
- Review the audit log monthly for unusual access.

# Database backup policy

Database dumps are never committed because they can contain NIK, email,
activity logs, and integration configuration. Production backups must use the
Supabase or database-provider backup facility.

Before a public deployment, restore at least one current backup into an
isolated test database and verify that migrations, reference seeds, and the
application boot successfully against the restored copy.

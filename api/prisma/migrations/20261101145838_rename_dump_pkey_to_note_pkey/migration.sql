-- The rename migration renamed the Group primary key, its unique index and the
-- join-table constraints, but missed the Note primary key, so the renamed table
-- still carried `Dump_pkey`.

-- AlterTable
ALTER TABLE "Note" RENAME CONSTRAINT "Dump_pkey" TO "Note_pkey";

-- Give notes and groups an owner. Rows created before this migration predate
-- per-user ownership, so they are assigned to the oldest user; if there is no
-- user at all, nothing can own them and they are dropped.

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "userId" TEXT;
ALTER TABLE "Note" ADD COLUMN "userId" TEXT;

-- Backfill
UPDATE "Group"
SET "userId" = (SELECT "id" FROM "User" ORDER BY "id" LIMIT 1)
WHERE "userId" IS NULL;

UPDATE "Note"
SET "userId" = (SELECT "id" FROM "User" ORDER BY "id" LIMIT 1)
WHERE "userId" IS NULL;

DELETE FROM "Note" WHERE "userId" IS NULL;
DELETE FROM "Group" WHERE "userId" IS NULL;

ALTER TABLE "Group" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Note" ALTER COLUMN "userId" SET NOT NULL;

-- DropIndex
DROP INDEX "Group_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Group_userId_name_key" ON "Group"("userId", "name");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

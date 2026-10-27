-- Rename the tag concept to deck in place: every table keeps its rows, and the
-- implicit join tables keep their links. `prisma migrate dev` would emit a
-- drop-and-create here, which would throw the existing dumps away.

-- AlterTable: Tag → Deck, same columns on both sides
ALTER TABLE "Tag" RENAME TO "Deck";
ALTER INDEX "Tag_name_key" RENAME TO "Deck_name_key";
ALTER TABLE "Deck" RENAME CONSTRAINT "Tag_pkey" TO "Deck_pkey";

-- CreateTable: _DumpToTag → _DeckToDump. The alphabetical order flips (Deck <
-- Dump), so the sides swap: "A" held the dump id and must now hold the deck id.
-- A rename would leave every link pointing at the wrong table.
CREATE TABLE "_DeckToDump" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeckToDump_AB_pkey" PRIMARY KEY ("A","B")
);

-- Carry the links over, swapping the sides
INSERT INTO "_DeckToDump" ("A", "B") SELECT "B", "A" FROM "_DumpToTag";

CREATE INDEX "_DeckToDump_B_index" ON "_DeckToDump"("B");

ALTER TABLE "_DeckToDump" ADD CONSTRAINT "_DeckToDump_A_fkey" FOREIGN KEY ("A") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DeckToDump" ADD CONSTRAINT "_DeckToDump_B_fkey" FOREIGN KEY ("B") REFERENCES "Dump"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "_DumpToTag";

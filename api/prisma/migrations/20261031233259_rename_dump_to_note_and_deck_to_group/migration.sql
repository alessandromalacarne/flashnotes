-- Rename the dump concept to note and deck concept to group in place: every
-- table keeps its rows, and the implicit join tables keep their links.

-- AlterTable: Dump → Note
ALTER TABLE "Dump" RENAME TO "Note";

-- AlterTable: Deck → Group
ALTER TABLE "Deck" RENAME TO "Group";
ALTER INDEX "Deck_name_key" RENAME TO "Group_name_key";
ALTER TABLE "Group" RENAME CONSTRAINT "Deck_pkey" TO "Group_pkey";

-- AlterTable: _DeckToDump → _GroupToNote (names already line up: A=deck/group, B=dump/note)
ALTER TABLE "_DeckToDump" RENAME TO "_GroupToNote";
ALTER INDEX "_DeckToDump_B_index" RENAME TO "_GroupToNote_B_index";
ALTER TABLE "_GroupToNote" RENAME CONSTRAINT "_DeckToDump_AB_pkey" TO "_GroupToNote_AB_pkey";
ALTER TABLE "_GroupToNote" RENAME CONSTRAINT "_DeckToDump_A_fkey" TO "_GroupToNote_A_fkey";
ALTER TABLE "_GroupToNote" RENAME CONSTRAINT "_DeckToDump_B_fkey" TO "_GroupToNote_B_fkey";

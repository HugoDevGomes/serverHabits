/*
  Warnings:

  - You are about to drop the column `user_Id` on the `days` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_days" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL
);
INSERT INTO "new_days" ("date", "id") SELECT "date", "id" FROM "days";
DROP TABLE "days";
ALTER TABLE "new_days" RENAME TO "days";
CREATE UNIQUE INDEX "days_date_key" ON "days"("date");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

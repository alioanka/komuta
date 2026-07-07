-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneE164" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");


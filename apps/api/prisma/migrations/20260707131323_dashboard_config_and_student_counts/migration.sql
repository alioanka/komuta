-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "studentLise" INTEGER,
ADD COLUMN     "studentOrtaokul" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dashboardConfig" JSONB;

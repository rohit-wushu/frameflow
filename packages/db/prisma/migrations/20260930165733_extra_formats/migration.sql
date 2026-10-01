-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "extraFormats" TEXT[] DEFAULT ARRAY[]::TEXT[];

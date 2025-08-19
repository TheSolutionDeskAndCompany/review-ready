/*
  Warnings:

  - Added the required column `org_id` to the `location_sources` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."location_sources" ADD COLUMN     "org_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."location_sources" ADD CONSTRAINT "location_sources_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

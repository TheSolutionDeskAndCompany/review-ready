/*
  Warnings:

  - A unique constraint covering the columns `[provider,external_id]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."reviews" ADD COLUMN     "author_url" TEXT,
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "platform_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reviews_provider_external_id_key" ON "public"."reviews"("provider", "external_id");

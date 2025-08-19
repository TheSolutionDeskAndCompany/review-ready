/*
  Warnings:

  - A unique constraint covering the columns `[review_id,org_id]` on the table `review_replies` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "review_replies_review_id_org_id_key" ON "public"."review_replies"("review_id", "org_id");

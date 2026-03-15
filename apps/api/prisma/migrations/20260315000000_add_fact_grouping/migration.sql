-- AlterTable
ALTER TABLE "factrail"."facts" ADD COLUMN "group_id" TEXT;
ALTER TABLE "factrail"."facts" ADD COLUMN "group_type" TEXT;
ALTER TABLE "factrail"."facts" ADD COLUMN "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "facts_group_id_idx" ON "factrail"."facts"("group_id");

-- CreateIndex
CREATE INDEX "facts_parent_id_idx" ON "factrail"."facts"("parent_id");

-- AddForeignKey
ALTER TABLE "factrail"."facts" ADD CONSTRAINT "facts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "factrail"."facts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

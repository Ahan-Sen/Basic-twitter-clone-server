-- CreateTable
CREATE TABLE "Following" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "followId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Following_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Following" ADD CONSTRAINT "Following_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

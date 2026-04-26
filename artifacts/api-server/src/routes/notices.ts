import { Router, type IRouter } from "express";
import { db, noticesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { PostNoticeBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notices", async (_req, res) => {
  const notices = await db
    .select()
    .from(noticesTable)
    .orderBy(desc(noticesTable.createdAt))
    .limit(50);
  res.json(notices);
});

router.post("/notices", async (req, res) => {
  const body = PostNoticeBody.parse(req.body);

  const [notice] = await db
    .insert(noticesTable)
    .values({
      playerId: body.playerId,
      username: body.username,
      content: body.content,
      campaignTitle: body.campaignTitle ?? null,
    })
    .returning();

  res.status(201).json(notice);
});

export default router;

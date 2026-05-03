import { Router, type IRouter } from "express";
import { db, inventoryItemsTable, charactersTable, campaignsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  GetInventoryParams,
  AddInventoryItemParams,
  AddInventoryItemBody,
  RemoveInventoryItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/campaigns/:campaignId/characters/:characterId/inventory", async (req, res) => {
  const { campaignId, characterId } = GetInventoryParams.parse({
    campaignId: req.params.campaignId,
    characterId: req.params.characterId,
  });
  const items = await db
    .select()
    .from(inventoryItemsTable)
    .where(and(
      eq(inventoryItemsTable.characterId, characterId),
      eq(inventoryItemsTable.campaignId, campaignId),
    ))
    .orderBy(inventoryItemsTable.createdAt);
  res.json(items);
});

router.post("/campaigns/:campaignId/characters/:characterId/inventory", async (req, res) => {
  const { campaignId, characterId } = AddInventoryItemParams.parse({
    campaignId: req.params.campaignId,
    characterId: req.params.characterId,
  });
  const body = AddInventoryItemBody.parse(req.body);

  const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId)).limit(1);
  if (!char) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  const [camp] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId)).limit(1);
  if (!camp) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const [item] = await db
    .insert(inventoryItemsTable)
    .values({
      characterId,
      campaignId,
      name: body.name,
      description: body.description ?? null,
      type: body.type,
      quantity: body.quantity,
    })
    .returning();

  res.status(201).json(item);
});

router.delete("/campaigns/:campaignId/characters/:characterId/inventory/:itemId", async (req, res) => {
  const { campaignId, characterId, itemId } = RemoveInventoryItemParams.parse({
    campaignId: req.params.campaignId,
    characterId: req.params.characterId,
    itemId: req.params.itemId,
  });

  await db
    .delete(inventoryItemsTable)
    .where(and(
      eq(inventoryItemsTable.id, itemId),
      eq(inventoryItemsTable.characterId, characterId),
      eq(inventoryItemsTable.campaignId, campaignId),
    ));

  res.json({ success: true, message: "Item removed" });
});

export default router;

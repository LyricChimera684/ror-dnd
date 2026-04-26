import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import campaignsRouter from "./campaigns";
import gameRouter from "./game";
import inventoryRouter from "./inventory";
import noticesRouter from "./notices";
import extrasRouter from "./extras";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(campaignsRouter);
router.use(gameRouter);
router.use(inventoryRouter);
router.use(noticesRouter);
router.use(extrasRouter);

export default router;

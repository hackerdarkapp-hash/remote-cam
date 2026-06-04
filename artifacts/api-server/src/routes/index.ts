import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { streamRouter } from "./streaming";

const router: IRouter = Router();

router.use(healthRouter);
router.use(streamRouter);

export default router;

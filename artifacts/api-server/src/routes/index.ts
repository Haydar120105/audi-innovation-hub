import { Router, type IRouter } from "express";
import healthRouter from "./health";
import applicationsRouter from "./applications";
import chatRouter from "./chat";
import extractPdfRouter from "./extract-pdf";

const router: IRouter = Router();

router.use(healthRouter);
router.use(applicationsRouter);
router.use(chatRouter);
router.use(extractPdfRouter);

export default router;

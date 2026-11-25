import { Router } from "express";
import { SuperAdminController } from "../controllers/superAdmin.auth.controller";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin";

const superAdminController = new SuperAdminController();

const router = Router();

router.get("/login",superAdminController.loginPage.bind(superAdminController));
router.get("/getAllUser",requireSuperAdmin,superAdminController.getAllUserData.bind(superAdminController));
router.post("/login",superAdminController.login.bind(superAdminController));

export default router;
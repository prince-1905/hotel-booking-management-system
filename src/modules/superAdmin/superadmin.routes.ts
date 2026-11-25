import express from "express";
import tenantRoutes from "./routes/tenant.routes";
import superAdminAuthRoutes from "./routes/superAdmin.auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import { requireSuperAdmin } from "./middlewares/requireSuperAdmin";


const router = express.Router();

/**
 * BASE: /superadmin
 * /auth/login is public; everything else requires a SUPER_ADMIN login.
 */
router.use("/hotels", requireSuperAdmin, tenantRoutes);
router.use("/auth",superAdminAuthRoutes)
router.use("/dashboard", requireSuperAdmin, dashboardRoutes)


export default router;

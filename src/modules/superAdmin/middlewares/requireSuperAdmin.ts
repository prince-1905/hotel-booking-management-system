import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../../../common/utils/jwt_token";
import { UserTokenPayload } from "../../../common/middlewares/verifyJWTToken";

/**
 * Guards every /superadmin page and API (except the login page itself).
 * Browser page loads are sent to the super-admin login; fetch()/API calls get a 401/403
 * so the page scripts can react instead of receiving a login page as "JSON".
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    const wantsHtml = req.method === "GET" && (req.headers.accept || "").includes("text/html");

    let user: UserTokenPayload | null = null;
    try {
        user = req.cookies?.token ? (verifyToken(req.cookies.token) as UserTokenPayload) : null;
    } catch {
        user = null;
    }

    if (!user) {
        if (wantsHtml) return res.redirect("/superadmin/auth/login");
        return res.status(401).json({ message: "Login required" });
    }
    if (user.roleId !== "SUPER_ADMIN") {
        if (wantsHtml) return res.redirect("/superadmin/auth/login?error=forbidden");
        return res.status(403).json({ message: "Super admin only" });
    }

    (req as any).user = user;
    next();
};

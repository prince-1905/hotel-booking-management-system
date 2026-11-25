import { Request, Response } from "express";
import { comparePassword, hashedPassword } from "../../../common/utils/hashPassword";
import { generateToken, storeToken } from "../../../common/utils/jwt_token";
import bcrypt from "bcrypt";
import { SuperAdminService } from "../services/superAdmin.auth.service";

const superAdminSerive = new SuperAdminService();

export class SuperAdminController {

    async loginPage(req:Request, res:Response){
        const errors: Record<string, string> = {
            invalid: "Invalid email or password.",
            forbidden: "That account is not a super admin.",
        };
        res.render("superAdmin/login", { error: errors[String(req.query.error)] || null });
    }

    // Form POST (redirects) or JSON POST (returns JSON). Sets the same httpOnly
    // "token" cookie as the main login, with role SUPER_ADMIN, which
    // requireSuperAdmin checks on every /superadmin route.
    async login(req: Request, res: Response) {
        const isJson = req.is("application/json");
        const fail = () => isJson
            ? res.status(400).json({ message: "Invalid email or password" })
            : res.redirect("/superadmin/auth/login?error=invalid");
        try {
            const email = req.body.email;
            const plainPass = req.body.password_hash;
            if (!email || !plainPass) return fail();

            // findByEmail only matches users with the SUPER_ADMIN role
            const superAdminData: any = await superAdminSerive.findByEmail(email);
            const ok = await comparePassword(superAdminData.password_hash, plainPass);
            if (!ok) return fail();

            storeToken(generateToken(superAdminData.user_id, "SUPER_ADMIN"), res);
            return isJson
                ? res.status(200).json({ message: "success" })
                : res.redirect("/superadmin/dashboard");
        }
        catch (err: any) {
            return fail();
        }
    }

    async getAllUserData(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const data = await superAdminSerive.getAllUserData();
            if (!data) {
                res.status(400).json("Data not found");
            }
             if (req.headers.accept?.includes("application/json")) {
      return res.json(data);
    }
    res.render("superAdmin/hotels_list", { data });
            // res.json(data);

        }
        catch (err) {
            res.status(400).json(err);
        }
    }




}

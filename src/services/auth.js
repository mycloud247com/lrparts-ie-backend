import bcrypt from "bcrypt";
import crypto from "crypto";
import { generateToken, setRefreshCookie, clearRefreshCookie } from "../../middlewares/authenticate.js";
import { notify } from "./notifier.js";

class AuthService {
  constructor(context) {
    this.context = context;
    this.db = context.db;
    this.req = context.req;
    this.res = context.res;
    this.errorManager = context.errorManager;
  }

  async register(data) {
    const { email, password, firstName, lastName, phone } = data;

    const existing = await this.db.User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw this.errorManager.getError("EMAIL_ALREADY_EXISTS");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await this.db.User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      verificationToken,
      emailVerified: false,
    });

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = generateToken(tokenPayload, "access");
    const refreshToken = generateToken(tokenPayload, "refresh");

    setRefreshCookie(this.res, refreshToken);

    // Send verification email (non-blocking)
    notify("VERIFICATION_EMAIL", { user, verificationToken });

    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  async login(data) {
    const { email, password } = data;

    const user = await this.db.User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw this.errorManager.getError("INVALID_CREDENTIALS");
    }

    if (user.status === "suspended") {
      throw this.errorManager.getError("FORBIDDEN", "Your account has been suspended");
    }

    // Google-only users can't login with password
    if (!user.password) {
      throw this.errorManager.getError("BAD_REQUEST", "This account uses Google sign-in. Please use the Google button to log in.");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw this.errorManager.getError("INVALID_CREDENTIALS");
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = generateToken(tokenPayload, "access");
    const refreshToken = generateToken(tokenPayload, "refresh");

    setRefreshCookie(this.res, refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  // ─── Google OAuth ───

  async googleAuth(googleUser) {
    const { googleId, email, firstName, lastName } = googleUser;

    // Check if user exists by googleId
    let user = await this.db.User.findOne({ where: { googleId } });

    if (!user) {
      // Check if email already exists (user registered with email/password)
      user = await this.db.User.findOne({ where: { email: email.toLowerCase() } });

      if (user) {
        // Link Google account to existing user
        await user.update({ googleId, emailVerified: true });
      } else {
        // Create new user from Google
        user = await this.db.User.create({
          googleId,
          email: email.toLowerCase(),
          firstName,
          lastName,
          password: null,
          emailVerified: true, // Google already verified the email
        });

        notify("WELCOME", { user });
      }
    }

    if (user.status === "suspended") {
      throw this.errorManager.getError("FORBIDDEN", "Your account has been suspended");
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = generateToken(tokenPayload, "access");
    const refreshToken = generateToken(tokenPayload, "refresh");

    setRefreshCookie(this.res, refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  // ─── Email Verification ───

  async verifyEmail(token) {
    const user = await this.db.User.findOne({ where: { verificationToken: token } });
    if (!user) {
      throw this.errorManager.getError("INVALID_TOKEN", "Invalid or expired verification link");
    }

    await user.update({ emailVerified: true, verificationToken: null });

    notify("WELCOME", { user });

    return { success: true, message: "Email verified successfully" };
  }

  async resendVerification(userId) {
    const user = await this.db.User.findByPk(userId);
    if (!user) throw this.errorManager.getError("USER_NOT_FOUND");

    if (user.emailVerified) {
      return { success: true, message: "Email already verified" };
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await user.update({ verificationToken });

    notify("VERIFICATION_EMAIL", { user, verificationToken });
    return { success: true, message: "Verification email sent" };
  }

  // ─── Existing methods ───

  async getUserInfo(userId) {
    const user = await this.db.User.findOne({
      where: { id: userId },
      attributes: { exclude: ["password"] },
    });
    if (!user) throw this.errorManager.getError("USER_NOT_FOUND");
    return user;
  }

  async updateUserInfo(userId, data) {
    const allowed = ["firstName", "lastName", "phone"];
    const updates = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updates[key] = data[key];
    }

    await this.db.User.update(updates, { where: { id: userId } });
    return this.getUserInfo(userId);
  }

  async logout() {
    clearRefreshCookie(this.res);
    return { success: true };
  }

  // ─── Addresses ───

  async getAddresses(userId) {
    return this.db.UserAddress.findAll({
      where: { userId },
      order: [["isDefault", "DESC"], ["createdAt", "DESC"]],
    });
  }

  async createAddress(userId, data) {
    if (data.isDefault) {
      await this.db.UserAddress.update({ isDefault: false }, { where: { userId } });
    }
    return this.db.UserAddress.create({ ...data, userId });
  }

  async updateAddress(userId, addressId, data) {
    const address = await this.db.UserAddress.findOne({ where: { id: addressId, userId } });
    if (!address) throw this.errorManager.getError("NOT_FOUND");

    if (data.isDefault) {
      await this.db.UserAddress.update({ isDefault: false }, { where: { userId } });
    }
    await address.update(data);
    return address;
  }

  async removeAddress(userId, addressId) {
    const address = await this.db.UserAddress.findOne({ where: { id: addressId, userId } });
    if (!address) throw this.errorManager.getError("NOT_FOUND");
    await address.destroy();
    return { success: true };
  }

  async requestPasswordReset(email) {
    const user = await this.db.User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return { success: true, message: "If an account exists, a reset link has been sent" };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await this.db.User.update(
      { resetToken: hashedToken, resetTokenExpiry: expiry },
      { where: { id: user.id } }
    );

    notify("PASSWORD_RESET", { user, resetToken: rawToken });
    return { success: true, message: "If an account exists, a reset link has been sent" };
  }

  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await this.db.User.findOne({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { [this.db.Sequelize.Op.gt]: new Date() },
      },
    });
    if (!user) throw this.errorManager.getError("INVALID_TOKEN");

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.db.User.update(
      { password: hashed, resetToken: null, resetTokenExpiry: null },
      { where: { id: user.id } }
    );

    notify("PASSWORD_CHANGED", { user });

    return { success: true, message: "Password has been reset" };
  }

  sanitizeUser(user) {
    const { password, verificationToken, ...safe } = user.toJSON();
    return safe;
  }
}

export default AuthService;

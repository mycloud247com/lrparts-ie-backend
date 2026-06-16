import AuthService from "../services/auth.js";

class AuthController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.res = context.res;
    this.authService = new AuthService(context);
  }

  async register() {
    const { email, password, firstName, lastName, phone } = this.req.body;
    if (!email || !password || !firstName || !lastName) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Email, password, first name and last name are required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Please enter a valid email address");
    }
    if (password.length < 8) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Password must be at least 8 characters");
    }
    if (phone && !/^\+?[\d\s()\-]{7,20}$/.test(phone)) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Please enter a valid phone number");
    }
    return this.authService.register({ email, password, firstName, lastName, phone });
  }

  async login() {
    const { email, password } = this.req.body;
    if (!email || !password) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Email and password are required");
    }
    return this.authService.login({ email, password });
  }

  async googleAuth() {
    const { credential } = this.req.body;
    if (!credential) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Google credential is required");
    }

    // Decode the Google ID token (JWT) to extract user info
    // Google ID tokens are JWTs — we decode and verify the payload
    const payload = await this.verifyGoogleToken(credential);

    return this.authService.googleAuth({
      googleId: payload.sub,
      email: payload.email,
      firstName: payload.given_name || payload.name?.split(" ")[0] || "",
      lastName: payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "",
    });
  }

  async verifyGoogleToken(credential) {
    // Verify the token with Google's tokeninfo endpoint
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!res.ok) {
      throw this.context.errorManager.getError("UNAUTHORIZED", "Invalid Google token");
    }
    const payload = await res.json();

    // Verify the token was issued for our client ID
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      throw this.context.errorManager.getError("UNAUTHORIZED", "Google token audience mismatch");
    }

    if (!payload.email) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Google account has no email");
    }

    return payload;
  }

  async verifyEmail() {
    const { token } = this.req.body;
    if (!token) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Verification token is required");
    }
    return this.authService.verifyEmail(token);
  }

  async resendVerification() {
    return this.authService.resendVerification(this.req.user.id);
  }

  async refresh() {
    const { refreshAccessToken } = await import("../../middlewares/authenticate.js");
    const { accessToken, user } = await refreshAccessToken(this.req);
    return { accessToken, user };
  }

  async logout() {
    return this.authService.logout();
  }

  async getUserInfo() {
    return this.authService.getUserInfo(this.req.user.id);
  }

  async updateUserInfo() {
    return this.authService.updateUserInfo(this.req.user.id, this.req.body);
  }

  async getAddresses() {
    return this.authService.getAddresses(this.req.user.id);
  }

  async createAddress() {
    return this.authService.createAddress(this.req.user.id, this.req.body);
  }

  async updateAddress() {
    return this.authService.updateAddress(this.req.user.id, this.req.params.addressId, this.req.body);
  }

  async removeAddress() {
    return this.authService.removeAddress(this.req.user.id, this.req.params.addressId);
  }

  async forgotPassword() {
    const { email } = this.req.body;
    if (!email) throw this.context.errorManager.getError("BAD_REQUEST", "Email is required");
    return this.authService.requestPasswordReset(email);
  }

  async resetPassword() {
    const { token, password } = this.req.body;
    if (!token || !password) throw this.context.errorManager.getError("BAD_REQUEST", "Token and password are required");
    return this.authService.resetPassword(token, password);
  }
}

export default AuthController;

import jwt from "jsonwebtoken";
import ErrorManager from "../src/utils/errorManager.js";

const errorManager = new ErrorManager();
const REFRESH_COOKIE = "lrp_refreshToken";

export const optionalAuthenticate = async (req, res, next) => {
  const token = req.headers?.authorization;
  if (!token || !token.startsWith("Bearer ")) return next();

  const decoded = verifyToken(token.split("Bearer ")[1]);
  if (decoded) {
    const { tokenType, iat, exp, ...userData } = decoded;
    req.user = userData;
  }
  next();
};

export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    // No access token — try refresh cookie
    try {
      const { accessToken, user } = await refreshAccessToken(req);
      req.user = user;
      // Attach new access token to response header for frontend to pick up
      res.setHeader("X-New-Access-Token", accessToken);
      return next();
    } catch {
      return next(errorManager.getError("UNAUTHORIZED"));
    }
  }

  const decoded = verifyToken(token.split("Bearer ")[1]);
  if (!decoded) {
    // Token expired/invalid — try refresh cookie before rejecting
    try {
      const { accessToken, user } = await refreshAccessToken(req);
      req.user = user;
      res.setHeader("X-New-Access-Token", accessToken);
      return next();
    } catch {
      return next(errorManager.getError("UNAUTHORIZED"));
    }
  }

  const { tokenType, iat, exp, ...userData } = decoded;
  req.user = userData;
  next();
};

export const refreshAccessToken = async (req) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) {
    throw errorManager.getError("UNAUTHORIZED");
  }

  const decoded = verifyToken(refreshToken);
  if (!decoded || decoded.tokenType !== "refresh") {
    throw errorManager.getError("UNAUTHORIZED");
  }

  const { tokenType, iat, exp, ...userData } = decoded;
  const accessToken = generateToken(userData, "access");
  return { accessToken, user: userData };
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

export const generateToken = (user, type) => {
  const expiresIn =
    type === "access"
      ? process.env.JWT_ACCESS_EXPIRES_IN
      : process.env.JWT_REFRESH_EXPIRES_IN;

  const { iat, exp, tokenType: _, ...userData } = user;
  return jwt.sign({ ...userData, tokenType: type }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

const isSecure = process.env.NODE_ENV === "production" || !!process.env.FRONTEND_URL?.startsWith("https");

export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
  });
};

export { REFRESH_COOKIE };

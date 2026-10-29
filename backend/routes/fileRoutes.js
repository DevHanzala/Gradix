import express from "express";
import { storage, verifyLocalSignature, contentDisposition } from "../helper/storage.js";

/**
 * Signed download links for the local storage driver (development). With R2 the
 * signed URL points straight at R2 and this route is not used. No login needed:
 * the HMAC signature, made after an access check, is the permission, and it expires.
 */
const router = express.Router();

router.get(/^\/(.+)$/, async (req, res, next) => {
  try {
    const { key, filename, contentType } = verifyLocalSignature({
      key: req.params[0],
      e: req.query.e,
      n: String(req.query.n || ""),
      t: String(req.query.t || ""),
      s: String(req.query.s || ""),
    });
    const body = await storage.get(key);
    res.set({
      "Content-Type": contentType || "application/octet-stream",
      "Content-Disposition": contentDisposition(filename || key.split("/").pop()),
      "Cache-Control": "private, no-store",
    });
    res.send(body);
  } catch (error) {
    next(error);
  }
});

export default router;

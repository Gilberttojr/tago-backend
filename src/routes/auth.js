const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const ctrl = require("../utils/wrapController")(
  require("../controllers/authController"),
);
const { exigirAutenticacao } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "..", "..", "uploads")),
  filename: (req, file, cb) =>
    cb(
      null,
      `perfil-${req.usuario._id}-${Date.now()}${path.extname(file.originalname)}`,
    ),
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

router.post("/login", ctrl.login);
router.get("/me", exigirAutenticacao, ctrl.me);
router.patch("/me", exigirAutenticacao, ctrl.atualizarPerfil);
router.post(
  "/me/foto",
  exigirAutenticacao,
  upload.single("foto"),
  ctrl.enviarFotoPerfil,
);

module.exports = router;

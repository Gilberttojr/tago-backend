const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const ctrl = require("../utils/wrapController")(
  require("../controllers/equipmentController"),
);
const { exigirAdministrador } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "..", "..", "uploads")),
  filename: (req, file, cb) =>
    cb(
      null,
      `${req.params.id}-${Date.now()}${path.extname(file.originalname)}`,
    ),
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Só é permitido enviar imagens"));
    cb(null, true);
  },
});

router.get("/", ctrl.listar);
router.get("/:id", ctrl.obter);
router.post("/", exigirAdministrador, ctrl.criar);
router.patch("/:id", exigirAdministrador, ctrl.atualizar);
router.post("/:id/status", exigirAdministrador, ctrl.mudarStatus);
router.post("/:id/entregar", exigirAdministrador, ctrl.entregar);
router.post(
  "/:id/configuracao",
  exigirAdministrador,
  ctrl.atualizarConfiguracao,
);
router.get("/:id/acessorios", ctrl.listarAcessorios);
router.post(
  "/:id/vincular-rastreador",
  exigirAdministrador,
  ctrl.vincularRastreador,
);
router.post("/:id/vincular-unidade", exigirAdministrador, ctrl.vincularUnidade);
router.post("/:id/vincular-tecnico", exigirAdministrador, ctrl.vincularTecnico);
router.post(
  "/:id/fotos",
  exigirAdministrador,
  upload.single("foto"),
  ctrl.adicionarFoto,
);
router.delete("/:id/fotos/:fotoId", exigirAdministrador, ctrl.removerFoto);
router.delete("/:id", exigirAdministrador, ctrl.remover);

module.exports = router;

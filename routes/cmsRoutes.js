const express = require("express");
const cmsController = require("../controllers/cmsController");

const router = express.Router();

router.get("/home", cmsController.listHome);
router.get("/home/:id", cmsController.getHomeById);
router.post("/home", cmsController.upsertHome);
router.patch("/home/:id", cmsController.patchHome);
router.put("/home/:id", cmsController.putHome);
router.delete("/home/:id", cmsController.deleteHome);

router.get("/header", cmsController.listHeader);
router.get("/header/:id", cmsController.getHeaderById);
router.post("/header", cmsController.upsertHeader);
router.patch("/header/:id", cmsController.patchHeader);
router.put("/header/:id", cmsController.putHeader);
router.delete("/header/:id", cmsController.deleteHeader);

router.get("/index", cmsController.listIndex);
router.get("/index/:id", cmsController.getIndexById);
router.post("/index", cmsController.upsertIndex);
router.patch("/index/:id", cmsController.patchIndex);
router.put("/index/:id", cmsController.putIndex);
router.put("/updateindex/:id", cmsController.putIndex);
router.delete("/index/:id", cmsController.deleteIndex);

module.exports = router;

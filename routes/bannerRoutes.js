const express = require("express");
const {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
} = require("../controllers/bannerController");

const router = express.Router();

router.post("/banners", createBanner); // Create a banner
router.get("/banners", getAllBanners); // Get all banners
router.get("/banners/:id", getBannerById); // Get single banner by ID
router.put("/banners/:id", updateBanner); // Update banner
router.delete("/banners/:id", deleteBanner); // Delete banner

module.exports = router;

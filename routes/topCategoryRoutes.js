const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig"); // Middleware for Image Upload
const { createTopCategory, getTopCategories, getTopCategory, updateTopCategory, deleteTopCategory } = require("../controllers/topCategoryController");

// Routes
router.post("/top-category", upload.fields([{ name: "image", maxCount: 1 }]), createTopCategory);
router.get("/top-category", getTopCategories); 
router.get("/top-category/:id", getTopCategory); 
router.put("/top-category/:id", upload.single("image"), updateTopCategory); 
router.delete("/top-category/:id", deleteTopCategory); 

module.exports = router;

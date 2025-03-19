const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig");
const categoryController = require("../controllers/categoryController");

// Create Category (with Cloudinary image upload)
router.post(
  "/category",
  upload.fields([{ name: "desktop", maxCount: 1 }, { name: "mobile", maxCount: 1 }]),
  categoryController.createCategory
);

// Get All Categories
router.get("/category", categoryController.getCategories);

// Update Category (with optional image upload)
router.put(
  "/category/:id",
  upload.fields([{ name: "desktop", maxCount: 1 }, { name: "mobile", maxCount: 1 }]),
  categoryController.updateCategory
);

// Delete Category
router.delete("/category/:id", categoryController.deleteCategory);

module.exports = router;

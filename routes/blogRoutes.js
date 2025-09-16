const express = require("express");
const upload = require("../config/multerConfig.js"); 
const blogController = require("../controllers/blogController.js");

const router = express.Router();

// Upload single image named 'image'
router.post("/", upload.single("image"), blogController.createBlog);

// Get all blogs
router.get("/", blogController.getBlogs);

// Get blog by slug
router.get("/blog/:slug", blogController.getBlogBySlug);
// Delete blog by ID
router.delete("/:id", blogController.deleteBlog);



module.exports = router;

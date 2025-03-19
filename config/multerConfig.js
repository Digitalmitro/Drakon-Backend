const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinaryConfig");

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "product-images", // Cloudinary folder name
    allowed_formats: ["jpg", "png", "jpeg","svg"],
  },
});

// Multer middleware
const upload = multer({ storage });

module.exports = upload;

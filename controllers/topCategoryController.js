
const TopCategory = require("../models/TopCategory");
const cloudinary = require("../config/cloudinaryConfig");

// Create a Top Category
exports.createTopCategory = async (req, res) => {
  try {
    const { title, description } = req.body;
    // Upload Image to Cloudinary
    const Image = req.files.image[0].path;
    
    const newCategory = new TopCategory({
      title,
      description,
      image: Image
    });

    await newCategory.save();
    res.status(201).json({ message: "Top Category Created", category: newCategory });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get All Top Categories
exports.getTopCategories = async (req, res) => {
  try {
    const categories = await TopCategory.find();
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Single Top Category
exports.getTopCategory = async (req, res) => {
  try {
    const category = await TopCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.status(200).json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a Top Category
exports.updateTopCategory = async (req, res) => {
  try {
    const { title, description } = req.body;
    let updateData = { title, description };

    // Upload New Image if Provided
    if (req.file) {
      const uploadResponse = await cloudinary.uploader.upload(req.file.path);
      updateData.image = uploadResponse.secure_url;
    }

    const updatedCategory = await TopCategory.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedCategory) return res.status(404).json({ error: "Category not found" });

    res.status(200).json({ message: "Category Updated", category: updatedCategory });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a Top Category
exports.deleteTopCategory = async (req, res) => {
  try {
    const category = await TopCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: "Category not found" });

    res.status(200).json({ message: "Category Deleted" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

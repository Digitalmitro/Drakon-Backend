const Category = require("../models/Category");

// Create Category
exports.createCategory = async (req, res) => {
  try {
    const { categoryName, title, description } = req.body;
    if (!req.files || !req.files.desktop || !req.files.mobile) {
      return res.status(400).json({ error: "Both desktop and mobile images are required." });
    }

    const desktopImage = req.files.desktop[0].path;
    const mobileImage = req.files.mobile[0].path;

    const newCategory = new Category({
      categoryName,
      title,    
      description,
      desktop_image: desktopImage,
      mobile_image: mobileImage,
    });

    await newCategory.save();
    res.status(201).json({ message: "Category created successfully", newCategory });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

// Get All Categories
exports.getCategories = async (req, res) => {
  try {
    const { categoryName } = req.query;
    let query = {};
    if (categoryName) {
      query.categoryName = categoryName; // Case-insensitive search
    }
    const categories = await Category.find(query);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update Category
exports.updateCategory = async (req, res) => {
  try {
    const { categoryName, title, description } = req.body;
    const categoryId = req.params.id;

    const updateData = { categoryName, title, description };

    if (req.files?.desktop) {
      updateData.desktop_image = req.files.desktop[0].path;
    }
    if (req.files?.mobile) {
      updateData.mobile_image = req.files.mobile[0].path;
    }

    const updatedCategory = await Category.findByIdAndUpdate(categoryId, updateData, { new: true });
    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category updated successfully", updatedCategory });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete Category
exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const deletedCategory = await Category.findByIdAndDelete(categoryId);
    if (!deletedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

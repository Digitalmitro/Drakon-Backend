const Banner = require("../models/Banner");

// Create a new banner
const createBanner = async (req, res) => {
  try {
    const { title, description, image } = req.body;

    if (!title || !description || !image) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newBanner = new Banner({ title, description, image });
    await newBanner.save();

    res.status(201).json({ message: "Banner created successfully", banner: newBanner });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json(banners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get a single banner by ID
const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: "Banner not found" });
    }
    res.status(200).json(banner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update banner
const updateBanner = async (req, res) => {
  try {
    const { title, description, image } = req.body;

    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
      { title, description, image },
      { new: true }
    );

    if (!updatedBanner) {
      return res.status(404).json({ error: "Banner not found" });
    }

    res.json({ message: "Banner updated successfully", banner: updatedBanner });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete banner
const deleteBanner = async (req, res) => {
  try {
    const deletedBanner = await Banner.findByIdAndDelete(req.params.id);
    if (!deletedBanner) {
      return res.status(404).json({ error: "Banner not found" });
    }
    res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
};

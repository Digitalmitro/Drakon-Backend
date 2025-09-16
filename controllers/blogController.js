const Blog = require("../models/Blog.js");

const blogController = {
  createBlog: async (req, res) => {
    try {
      const data = req.body;
      if (req.file && req.file.path) {
        data.image = req.file.path;
      }
      if (data.tags && typeof data.tags === "string") {
        data.tags = data.tags.split(",").map((tag) => tag.trim());
      }

      const blog = await Blog.create(data);

      res.status(201).json(blog);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  },

  // Get all blogs
  getBlogs: async (req, res) => {
    try {
      const blogs = await Blog.find().sort({ createdAt: -1 });
      res.status(200).json(blogs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // Get a single blog by slug
  getBlogBySlug: async (req, res) => {
    try {
      const { slug } = req.params;
      const blog = await Blog.findOne({ slug });
      if (!blog) return res.status(404).json({ message: "Blog not found" });
      res.status(200).json(blog);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  deleteBlog: async (req, res) => {
    try {
      const { id } = req.params;
      const blog = await Blog.findByIdAndDelete(id);
      if (!blog) return res.status(404).json({ message: "Blog not found" });
      res.status(200).json({ message: "Blog deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = blogController;

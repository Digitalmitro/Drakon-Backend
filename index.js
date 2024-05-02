const express = require("express");
const nodemailer = require("nodemailer");

const {
  RegisterclientModal,
} = require("./models/ClientModel/ClientRegisterModel");
const { ProductsModal } = require("./models/ClientModel/ProductModel");
const {InventoryroductModal} = require("./models/ClientModel/InventoryProduct")
const {FeaturedpoductModal} = require("./models/ClientModel/FeaturedProduct")
const {
  RegisteradminModal,
} = require("./models/AdminModel/RegisterAdminModel");
const {ContactcmsModel} = require("./models/CMS-Model/ContactCMS")
const {FootercmsModel} = require("./models/CMS-Model/FooterCms")
const cors = require("cors");
const bcrypt = require("bcrypt");
const { connect } = require("./config/db");
const jwt = require("jsonwebtoken");
const server = express();
server.use(express.json());
server.use(cors());

//welcome
server.get("/", (req, res) => {
  res.send("welcome");
});

//Gmail sent
server.post("/send-email", async (req, res) => {
  const { to, subject, html } = req.body;

  // Create a nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "tirtho.digitalmitro@gmail.com",
      pass: "iyyq whed pthy yuhs",
    },
  });

  // Define email options
  const mailOptions = {
    from: "tirtho.digitalmitro@gmail.com",
    to,
    subject,
    html,
    attachments: [
      {
        filename: subject,
        content:
          subject === "Digital Marketing Plan" ||
          subject === "SEO Plan" ||
          subject === "Social Media Marketing Plan"
            ? fs.createReadStream(
                "C:/Users/Day/Downloads/Backend_CRM/Digital_Marketing_Plan.pdf"
              )
            : fs.createReadStream(
                "C:/Users/Day/Downloads/Backend_CRM/Welcome_To_Digital_Mitro.pdf"
              ),
        contentType: "application/pdf",
      },
    ],
  };

  // Send the email
  try {
    // console.log(attachments);
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending email" });
  }
});

//ADMIN Section
// ADMIN  Register//
server.post("/registeradmin", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the email already exists in the database
    const existingAdvisor = await RegisteradminModal.findOne({ email });

    if (existingAdvisor) {
      // If email already exists, send an error response
      res.status(400).send("Email already exists");
    } else {
      // Hash the password
      bcrypt.hash(password, 5, async (err, hash) => {
        if (err) {
          console.log(err);
        } else {
          // Create a new instance of RegisteradvisorModal with the hashed password
          const newData = new RegisteradminModal({
            email,
            password: hash,
          });

          // Save the advisor data to the database
          await newData.save();

          // Send a success response
          res.send("Registered");
        }
      });
    }
  } catch (error) {
    // Handle other errors, such as missing details in the request
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
//ADMIN Login
server.post("/loginadmin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await RegisteradminModal.findOne({ email });
    if (user) {
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          const token = jwt.sign(
            {
              _id: user._id,

              email: user.email,
            },
            "Tirtho"
          );
          res.json({
            status: "login successful",
            token: token,
            user: {
              email: user.email,

              _id: user._id,

              // Add other user details if needed
            },
          });
        } else {
          res.status(401).json({ status: "wrong entry" });
        }
      });
    } else {
      res.status(404).json({ status: "user not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "internal server error" });
  }
});

//Client Section
// Client  Register//
server.post("/registerclient", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the email already exists in the database
    const existingAdvisor = await RegisterclientModal.findOne({ email });

    if (existingAdvisor) {
      // If email already exists, send an error response
      res.status(400).send("User already exists");
    } else {
      // Hash the password
      bcrypt.hash(password, 5, async (err, hash) => {
        if (err) {
          console.log(err);
        } else {
          // Create a new instance of RegisteradvisorModal with the hashed password
          const newData = new RegisterclientModal({
            email,

            password: hash,
          });

          // Save the advisor data to the database
          await newData.save();

          // Send a success response
          res.send("Registered");
        }
      });
    }
  } catch (error) {
    // Handle other errors, such as missing details in the request
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
//Client Login
server.post("/loginclient", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await RegisterclientModal.findOne({ email });
    if (user) {
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          const token = jwt.sign(
            {
              _id: user._id,

              email: user.email,
            },
            "Tirtho"
          );
          res.json({
            status: "login successful",
            token: token,
            user: {
              email: user.email,

              _id: user._id,

              // Add other user details if needed
            },
          });
        } else {
          res.status(401).json({ status: "wrong entry" });
        }
      });
    } else {
      res.status(404).json({ status: "user not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "internal server error" });
  }
});
//Update Client Detail
server.put("/updateclient", async (req, res) => {
  const { email, password, type, user_id } = req.body;

  try {
    // Hash the password
    bcrypt.hash(password, 10, async (err, hash) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Error hashing password" });
      }

      try {
        // Update user with hashed password
        const updatedUser = await RegisterclientModal.findByIdAndUpdate(
          user_id,
          { name, email, phone, password: hash, type },
          { new: true }
        );

        if (!updatedUser) {
          return res.status(404).json({ error: "User not found" });
        }

        // Optionally, you can return the updated user as JSON
        res.json("Updated user details successfully");
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Server error" });
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
});

//PRODUCTS SECTION
server.post("/products", async (req, res) => {
  const {
    image,
    title,
    description,
    price,
    year,
    cutting,
    grade,
    region,
    color,
    leaf,
    bleach,
    texture,
    steamSize,
  } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new ProductsModal({
      image,
      title,
      description,
      price,
      year,
      cutting,
      grade,
      region,
      color,
      leaf,
      bleach,
      texture,
      steamSize,
    });
    // Save the package to the database
    await newPackage.save();
    // Send a success response
    res.send("product created successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// GET all products
server.get("/products", async (req, res) => {
  try {
    const products = await ProductsModal.find();
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product by product by ID
server.get("/products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await ProductsModal.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product byID & DELETE
server.delete("/products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await ProductsModal.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});





//Inventory SECTION
server.post("/inv-products", async (req, res) => {
  const {
    image,
    title,
    description,
    price,
    year,
    cutting,
    grade,
    region,
    color,
    leaf,
    bleach,
    texture,
    steamSize,
  } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new InventoryroductModal({
      image,
      title,
      description,
      price,
      year,
      cutting,
      grade,
      region,
      color,
      leaf,
      bleach,
      texture,
      steamSize,
    });
    // Save the package to the database
    await newPackage.save();
    // Send a success response
    res.send("product created successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// GET all products
server.get("/inv-products", async (req, res) => {
  try {
    const products = await InventoryroductModal.find();
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product by product by ID
server.get("/inv-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await InventoryroductModal.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product byID & DELETE
server.delete("/inv-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await InventoryroductModal.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



//Featured SECTION
server.post("/feature-products", async (req, res) => {
  const {
    image,
    title,
    description,
    price,
    year,
    cutting,
    grade,
    region,
    color,
    leaf,
    bleach,
    texture,
    steamSize,
  } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new FeaturedpoductModal({
      image,
      title,
      description,
      price,
      year,
      cutting,
      grade,
      region,
      color,
      leaf,
      bleach,
      texture,
      steamSize,
    });
    // Save the package to the database
    await newPackage.save();
    // Send a success response
    res.send("product created successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// GET all products
server.get("/feature-products", async (req, res) => {
  try {
    const products = await FeaturedpoductModal.find();
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product by product by ID
server.get("/feature-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await FeaturedpoductModal.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product byID & DELETE
server.delete("/feature-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await FeaturedpoductModal.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});







//CONTACT CMS
// Create Contact CMS ADMIN populate
server.post("/contactcms", async (req, res) => {
  const {
    about,
    address,
    email,
    phone,
    user_id,
  } = req.body;

  try {
    // Find the existing homecms document for the given user_id
    const existingPackage = await ContactcmsModel.findOne({ user_id });

    if (!existingPackage) {
      // If no existing document, create a new one
      const newPackage = new ContactcmsModel({
        about,
        address,
        email,
        phone,
        user_id,
      });

      // Save the new document to the database
      await newPackage.save();
      await RegisteradminModal.findByIdAndUpdate(
        user_id,
        { $push: { contactcms: newPackage._id } },
        { new: true }
      );
    } else {
      // If an existing document is found, update its fields
      await ContactcmsModel.findOneAndUpdate(
        { user_id },
        {
          about,
          address,
          email,
          phone,
        },
        { new: true }
      );
    }

    // Send a success response
    res.send("Contact CMS Created/Updated");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
//  Contact CMS GET
server.get("/contactcms", async (req, res) => {
  try {
    const data = await ContactcmsModel.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});


//FOOTER CMS
server.post("/footercms", async (req, res) => {
  const {
    OfficeAddress1,
    OfficeAddress2,
    MailAddress1,
    MailAddress2,
    MapEmbededUrl,
    user_id,
  } = req.body;

  try {
    // Find the existing homecms document for the given user_id
    const existingPackage = await FootercmsModel.findOne({ user_id });

    if (!existingPackage) {
      // If no existing document, create a new one
      const newPackage = new FootercmsModel({
        OfficeAddress1,
        OfficeAddress2,
        MailAddress1,
        MailAddress2,
        MapEmbededUrl,
        user_id,
      });

      // Save the new document to the database
      await newPackage.save();
      await RegisteradminModal.findByIdAndUpdate(
        user_id,
        { $push: { footercms: newPackage._id } },
        { new: true }
      );
    } else {
      // If an existing document is found, update its fields
      await FootercmsModel.findOneAndUpdate(
        { user_id },
        {
          OfficeAddress1,
          OfficeAddress2,
          MailAddress1,
          MailAddress2,
          MapEmbededUrl,
        },
        { new: true }
      );
    }

    // Send a success response
    res.send("Footer CMS Created/Updated");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
//  Contact CMS GET
server.get("/footercms", async (req, res) => {
  try {
    const data = await FootercmsModel.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});






//SERVER
//server running
server.listen(3500, async () => {
  try {
    await connect;
    console.log("mongoDb connected");
  } catch (error) {
    console.log(error);
  }
  console.log(`server running at port 3500`);
});

const jwt = require("jsonwebtoken");
const { RegisteradminModal } = require("../AdminModel/RegisterAdminModel");
const { RegisterclientModal } = require("../ClientModel/RegisterClientModel");


const userAuth = async (req, res, next) => {
  try {
    const token = req.headers.token;
    const verifyToken =  jwt.verify(token, process.env.secret_key);

    console.log(verifyToken);

    const rootUser = await RegisterclientModal.findOne({ _id: verifyToken._id });
    const rootAdmin = await RegisteradminModal.findById(verifyToken._id);

    console.log(rootUser);

    if (!rootUser && !rootAdmin) {
      throw new Error("User Not Found.");
    }

    req.token = token;
    req.rootUser = rootUser || rootAdmin;

    next();
  } catch (error) {
    res.status(401).send("Unauthorized : No token provided");
    console.log(error);
  }
};

module.exports = userAuth;

const jwt = require("jsonwebtoken");
const { RegisteradminModal } = require("../AdminModel/RegisterAdminModel");
const { RegisterclientModal } = require("../ClientModel/RegisterClientModel");


const userAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access Denied. No token provided' });
    }
  
    const token = authHeader.split(' ')[1]; // Extract token after "Bearer"
  
    const verifyToken =  jwt.verify(token, process.env.secret_key);
    const rootUser = await RegisterclientModal.findOne({ _id: verifyToken._id });
    const rootAdmin = await RegisteradminModal.findById(verifyToken._id);

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

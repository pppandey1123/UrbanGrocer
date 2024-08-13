const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const Stripe = require("stripe");

const app = express();

// Enable CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8080;

// MongoDB connection
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.log("Database connection error: ", err));

// Schema
const userSchema = mongoose.Schema({
  firstName: String,
  lastName: String,
  email: {
    type: String,
    unique: true,
  },
  password: String,
  confirmPassword: String,
  image: String,
});

const userModel = mongoose.model("user", userSchema);

// API routes
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Sign-up API
app.post("/signup", async (req, res) => {
  const { email } = req.body;

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.send({ message: "Email ID is already registered", alert: false });
    }
    const newUser = new userModel(req.body);
    await newUser.save();
    res.send({ message: "Successfully signed up", alert: true });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error signing up", alert: false });
  }
});

// Login API
app.post("/login", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (user) {
      const dataSend = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        image: user.image,
      };
      res.send({ message: "Login successfully", alert: true, data: dataSend });
    } else {
      res.send({ message: "Email is not available, please sign up", alert: false });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error logging in", alert: false });
  }
});

// Product schema and model
const schemaProduct = mongoose.Schema({
  name: String,
  category: String,
  image: String,
  price: Number,
  description: String,
});

const productModel = mongoose.model("product", schemaProduct);

// Upload product API
app.post("/uploadProduct", async (req, res) => {
  try {
    const newProduct = new productModel(req.body);
    await newProduct.save();
    res.send({ message: "Uploaded successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error uploading product" });
  }
});

// Get products API
app.get("/product", async (req, res) => {
  try {
    const products = await productModel.find({});
    res.send(products);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error fetching products" });
  }
});

// Stripe payment gateway
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post("/create-checkout-session", async (req, res) => {
  try {
    const params = {
      submit_type: "pay",
      mode: "payment",
      payment_method_types: ["card"],
      billing_address_collection: "auto",
      shipping_options: [{ shipping_rate: "shr_1PmS0z052DNLtlAfgditd2Np" }],
      line_items: req.body.map((item) => ({
        price_data: {
          currency: "cad",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price * 100,
        },
        adjustable_quantity: {
          enabled: true,
          minimum: 1,
        },
        quantity: item.qty,
      })),
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    };

    const session = await stripe.checkout.sessions.create(params);
    res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
});

// Start the server
app.listen(PORT, () => console.log("Server is running at port: " + PORT));

const dns = require("dns");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const errorHandler = require("../middleware/error");
const authRoutes = require("../routes/authRoutes");
const userRoutes = require("../routes/userRoutes");
const jobsTypeRoutes = require("../routes/jobsTypeRoutes");
const jobsRoutes = require("../routes/jobsRoutes");
const jobLocationRoutes = require("../routes/jobLocationRoutes");
const applicationRoutes = require("../routes/applicationRoutes");

const app = express();
const mongoUri = process.env.MONGO_URI || process.env.URI || process.env.DATABASE;
const frontendOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://hire-ly.vercel.app",
  "https://talent-sphere-qqrm.vercel.app",
].filter(Boolean).map((origin) => origin.replace(/\/+$/, ""));

let connectPromise;

const ensureDatabaseConnection = async () => {
  if (!mongoUri) {
    throw new Error("MongoDB URI is missing. Set MONGO_URI, URI, or DATABASE.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(mongoUri).catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
};

const requireRuntimeConfig = (req, res, next) => {
  const missing = [];

  if (!mongoUri) {
    missing.push("MONGO_URI/URI/DATABASE");
  }

  if (!process.env.JWT_SECRET) {
    missing.push("JWT_SECRET");
  }

  if (missing.length) {
    return res.status(500).json({
      success: false,
      error: `Missing required environment variables: ${missing.join(", ")}`,
    });
  }

  return next();
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, "");
    if (frontendOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Auth-Token", "Token"],
};

app.use(bodyParser.json({ limit: "5mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "5mb",
    extended: true,
  })
);
app.use(cookieParser());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(requireRuntimeConfig);
app.use(async (req, res, next) => {
  try {
    await ensureDatabaseConnection();
    return next();
  } catch (error) {
    return next(error);
  }
});

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", jobsTypeRoutes);
app.use("/api", jobLocationRoutes);
app.use("/api", jobsRoutes);
app.use("/api/applications", applicationRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 8000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;

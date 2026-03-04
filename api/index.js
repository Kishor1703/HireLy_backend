const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const errorHandler = require("../middleware/error");
const authRoutes = require("../routes/authRoutes");
const userRoutes = require("../routes/userRoutes");
const jobsTypeRoutes = require("../routes/jobsTypeRoutes");
const jobsRoutes = require("../routes/jobsRoutes");
const applicationRoutes = require("../routes/applicationRoutes");
// const serverless = require("serverless-http");
const app = express();
const port = process.env.PORT || 8000;
const mongoUri = process.env.MONGO_URI || process.env.URI || process.env.DATABASE;

if (!mongoUri) {
  console.error("MongoDB URI is missing. Set MONGO_URI (or URI / DATABASE) in env.");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in .env.");
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => console.log("DB connected"))
  .catch((err) => console.log(err));

// app.use(morgan("dev"));
app.use(bodyParser.json({ limit: "5mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "5mb",
    extended: true,
  })
);
app.use(cookieParser());
const allowedOrigins = [
  (process.env.FRONTEND_ORIGIN ||"https://talent-sphere-qqrm.vercel.app/").replace(/\/$/, ""),
  "https://hire-ly.vercel.app/","https://talent-sphere-qqrm.vercel.app/","https://talent-sphere-qqrm.vercel.app/".replace(/\/$/, ""),
  ,
];
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, "");
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Auth-Token", "Token"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", jobsTypeRoutes);
app.use("/api", jobsRoutes);
app.use("/api/applications", applicationRoutes);

app.use(errorHandler);

// local dev only
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

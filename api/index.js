const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const errorHandler = require("./middleware/error");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobsTypeRoutes = require("./routes/jobsTypeRoutes");
const jobsRoutes = require("./routes/jobsRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const serverless = require("serverless-http");
const app = express();
const port = process.env.PORT || 8000;
const mongoUri = process.env.URI || process.env.DATABASE;

if (!mongoUri) {
  console.error("MongoDB URI is missing. Set MONGO_URI or DATABASE in .env.");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in .env.");
  process.exit(1);
}

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
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
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'https://hire-ly.vercel.app/',
    credentials: true,
  })
);
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ limit: "5mb", extended: true }));

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", jobsTypeRoutes);
app.use("/api", jobsRoutes);
app.use("/api/applications", applicationRoutes);

app.use(errorHandler);

module.exports = app;
module.exports.handler = serverless(app);

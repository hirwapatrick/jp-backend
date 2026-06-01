import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import contactRoutes from "./routes/contact.js";

// Import models
import User from "./models/User.js";
import Event from "./models/Event.js";
import Media from "./models/Media.js";
import Contact from "./models/Contact.js";

// Import middleware
import { protect, admin, editor } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/error.js";
import {
  upload,
  uploadVideo,
  deleteFromCloudinary,
  generateThumbnail,
} from "./middleware/upload.js";

dotenv.config();

const app = express();

// ============================================
// CORS CONFIGURATION - FIXED
// ============================================
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://jacques-photographer.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/contact", contactRoutes);

// ============================================
// CLOUDINARY CONFIG - FIXED
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB Connected");

    // Create default admin if none exists
    const adminExists = await User.findOne({ role: "admin" });
    if (!adminExists) {
      await User.create({
        name: "Admin",
        email: "admin@photographer.com",
        password: "admin123",
        role: "admin",
      });
      console.log(
        "✅ Default admin created - Email: admin@photographer.com, Password: admin123",
      );
    }
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Helper function to extract video info from URLs
// Helper function to extract video info from URLs - FIXED VERSION
const extractVideoInfo = (url) => {
  let videoId = "";
  let platform = "";
  let thumbnail = "";

  console.log("Extracting video info from:", url);

  // YouTube
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "youtube";

    // youtube.com/watch?v=VIDEO_ID
    if (url.includes("youtube.com/watch")) {
      const urlParams = new URLSearchParams(url.split("?")[1]);
      videoId = urlParams.get("v");
    }
    // youtu.be/VIDEO_ID
    else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0];
    }

    thumbnail = videoId
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : "";
  }
  // Vimeo
  else if (url.includes("vimeo.com")) {
    platform = "vimeo";
    // Extract video ID from vimeo URL
    const matches = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    videoId = matches ? matches[1] : null;
    thumbnail = videoId ? `https://vumbnail.com/${videoId}.jpg` : "";
  }

  console.log("Extracted:", { videoId, platform, thumbnail });
  return { videoId, platform, thumbnail };
};

// ============================================
// TEST ROUTES - ADD THESE FIRST!
// ============================================

// Simple test route - NO AUTH REQUIRED
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date().toISOString(),
  });
});

// Test upload route - NO AUTH for testing
app.post("/api/test-upload", (req, res, next) => {
  upload.single("testImage")(req, res, (err) => {
    if (err) {
      console.error("Test upload error:", err);
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    res.json({
      success: true,
      message: "Test upload successful",
      file: req.file
        ? {
            path: req.file.path,
            filename: req.file.filename,
            public_id: req.file.filename,
            url: req.file.path,
          }
        : null,
    });
  });
});

// ============================================
// CLOUDINARY TEST ROUTE - FIXED
// ============================================
app.get("/api/cloudinary-test", (req, res) => {
  try {
    const config = cloudinary.config();
    res.json({
      success: true,
      cloud_name: config.cloud_name,
      api_key: config.api_key ? "✓ Configured" : "✗ Missing",
      api_secret: config.api_secret ? "✓ Configured" : "✗ Missing",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// @route   POST /api/auth/login
// @access  Public
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account is deactivated" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage?.url || "",
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/profile
// @access  Private
app.get("/api/auth/profile", protect, async (req, res) => {
  res.json(req.user);
});

// @route   PUT /api/auth/profile
// @access  Private
app.put(
  "/api/auth/profile",
  protect,
  (req, res, next) => {
    upload.single("profileImage")(req, res, (err) => {
      if (err) {
        console.error("Profile image upload error:", err);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;

      // Handle profile image upload
      if (req.file) {
        // Delete old image if exists
        if (user.profileImage?.publicId) {
          await deleteFromCloudinary(user.profileImage.publicId);
        }

        user.profileImage = {
          url: req.file.path,
          publicId: req.file.filename,
        };
      }

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profileImage: updatedUser.profileImage?.url || "",
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: error.message });
    }
  },
);

// @route   PUT /api/auth/change-password
// @access  Private
app.put("/api/auth/change-password", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/register
// @access  Private/Admin
app.post("/api/auth/register", protect, admin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "editor",
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error("User registration error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/users
// @access  Private/Admin
app.get("/api/auth/users", protect, admin, async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
app.delete("/api/auth/users/:id", protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Cannot delete admin user" });
    }

    await user.deleteOne();
    res.json({ message: "User removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// EVENT ROUTES
// ============================================

// @route   GET /api/events
// @access  Public
app.get("/api/events", async (req, res) => {
  try {
    const { status = "published", type, featured, search, limit } = req.query;
    const query = { status };

    if (type) query.eventType = type;
    if (featured) query.featured = featured === "true";
    if (search) {
      query.$or = [
        { eventName: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { clientName: { $regex: search, $options: "i" } },
      ];
    }

    let eventsQuery = Event.find(query)
      .populate({
        path: "media",
        options: { sort: { order: 1, createdAt: 1 } },
      })
      .sort("-createdAt");

    if (limit) {
      eventsQuery = eventsQuery.limit(parseInt(limit));
    }

    const events = await eventsQuery;

    // Log for debugging
    console.log(`Found ${events.length} events`);
    events.forEach((event) => {
      console.log(
        `Event: ${event.eventName}, Media count: ${event.media?.length || 0}`,
      );
    });

    res.json(events);
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/events/:id
// @access  Public
app.get("/api/events/:id", async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const event = await Event.findById(req.params.id)
      .populate("media")
      .populate("createdBy", "name email");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Sanitize password from public API response
    const eventObj = event.toObject ? event.toObject() : { ...event };
    if (eventObj.settings) {
      eventObj.settings = {
        ...eventObj.settings,
        password: eventObj.settings.password ? true : false,
      };
    }

    res.json(eventObj);
  } catch (error) {
    console.error("Get event error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/events/:id/verify-password
// @access  Public
app.post("/api/events/:id/verify-password", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid event ID format" });
    }

    const event = await Event.findById(req.params.id).select(
      "settings eventName",
    );
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    const { password } = req.body;
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "Password is required" });
    }

    const isCorrect =
      event.settings?.password && event.settings.password === password;
    if (!isCorrect) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });
    }

    res.json({ success: true, message: "Password verified" });
  } catch (error) {
    console.error("Password verification error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/events
// @access  Private (Admin/Editor)
app.post(
  "/api/events",
  protect,
  editor,
  (req, res, next) => {
    upload.single("coverImage")(req, res, (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({
          message: err.message || "File upload failed",
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const {
        eventName,
        eventType,
        location,
        date,
        description,
        clientName,
        tags,
        status,
        featured,
        settings,
      } = req.body;

      if (!eventName || !eventType || !location || !date) {
        return res.status(400).json({
          message: "Please provide event name, type, location, and date",
        });
      }

      // Handle cover image
      let coverImageData = { url: "", publicId: "" };
      if (req.file) {
        coverImageData = {
          url: req.file.path,
          publicId: req.file.filename,
        };

        console.log("✅ File uploaded:", {
          path: req.file.path,
          publicId: req.file.filename,
        });
      }

      // Parse tags
      let parsedTags = [];
      if (tags) {
        if (Array.isArray(tags)) {
          parsedTags = tags;
        } else if (typeof tags === "string") {
          parsedTags = tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t);
        }
      }

      // Parse settings
      let parsedSettings = {
        allowDownloads: false,
        password: null,
        expiresAt: null,
      };
      if (settings) {
        try {
          const parsed =
            typeof settings === "string" ? JSON.parse(settings) : settings;
          parsedSettings = {
            allowDownloads:
              parsed.allowDownloads === true ||
              parsed.allowDownloads === "true",
            password: parsed.password || null,
            expiresAt: parsed.expiresAt || null,
          };
        } catch (e) {
          console.error("Failed to parse settings:", e);
        }
      }

      const event = await Event.create({
        eventName,
        eventType,
        location,
        date,
        coverImage: coverImageData,
        description: description || "",
        clientName: clientName || "",
        tags: parsedTags,
        status: status || "draft",
        featured: featured === "true" || featured === true,
        settings: parsedSettings,
        createdBy: req.user._id,
      });

      res.status(201).json(event);
    } catch (error) {
      console.error("Event creation error:", error);
      res.status(500).json({ message: error.message });
    }
  },
);

// @route   PUT /api/events/:id
// @access  Private (Admin/Editor)
app.put(
  "/api/events/:id",
  protect,
  editor,
  (req, res, next) => {
    upload.single("coverImage")(req, res, (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID format",
        });
      }

      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check permission
      if (
        event.createdBy.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this event" });
      }

      const {
        eventName,
        eventType,
        location,
        date,
        description,
        clientName,
        tags,
        status,
        featured,
        settings,
      } = req.body;

      // Handle cover image update
      if (req.file) {
        if (event.coverImage?.publicId) {
          await deleteFromCloudinary(event.coverImage.publicId);
        }
        event.coverImage = {
          url: req.file.path,
          publicId: req.file.filename,
        };
      }

      // Update basic fields
      if (eventName) event.eventName = eventName;
      if (eventType) event.eventType = eventType;
      if (location) event.location = location;
      if (date) event.date = date;
      if (description !== undefined) event.description = description;
      if (clientName !== undefined) event.clientName = clientName;
      if (status) event.status = status;

      // Parse tags
      if (tags !== undefined) {
        if (Array.isArray(tags)) {
          event.tags = tags;
        } else if (typeof tags === "string") {
          event.tags = tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t);
        }
      }

      // Parse featured
      if (featured !== undefined) {
        event.featured = featured === "true" || featured === true;
      }

      // Parse settings
      if (settings !== undefined) {
        try {
          const parsed =
            typeof settings === "string" ? JSON.parse(settings) : settings;
          event.settings = {
            allowDownloads:
              parsed.allowDownloads === true ||
              parsed.allowDownloads === "true",
            password:
              parsed.password === ""
                ? event.settings?.password
                : parsed.password || null,
            expiresAt: parsed.expiresAt || null,
          };
        } catch (e) {
          console.error("Failed to parse settings:", e);
        }
      }

      const updatedEvent = await event.save();
      res.json(updatedEvent);
    } catch (error) {
      console.error("Event update error:", error);
      res.status(500).json({ message: error.message });
    }
  },
);

// @route   DELETE /api/events/:id
// @access  Private (Admin/Editor)
app.delete("/api/events/:id", protect, editor, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check permission
    if (
      event.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this event" });
    }

    // Delete cover image from Cloudinary
    if (event.coverImage?.publicId) {
      await deleteFromCloudinary(event.coverImage.publicId);
    }

    // Get all media for this event
    const mediaList = await Media.find({ event: event._id });

    // Delete all media from Cloudinary
    for (const media of mediaList) {
      if (media.publicId) {
        await deleteFromCloudinary(
          media.publicId,
          media.type === "video" ? "video" : "image",
        );
      }
      if (media.thumbnail?.publicId) {
        await deleteFromCloudinary(media.thumbnail.publicId);
      }
    }

    // Delete media from database
    await Media.deleteMany({ event: event._id });

    // Delete event
    await event.deleteOne();

    res.json({
      message: "Event and all associated media deleted successfully",
    });
  } catch (error) {
    console.error("Event deletion error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/events/:id/featured
// @access  Private (Admin/Editor)
app.patch("/api/events/:id/featured", protect, editor, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    event.featured = !event.featured;
    await event.save();

    res.json({
      featured: event.featured,
      message: event.featured ? "Event featured" : "Event unfeatured",
    });
  } catch (error) {
    console.error("Toggle featured error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// MEDIA ROUTES WITH CLOUDINARY
// ============================================
// IMPORTANT: Specific routes MUST come before parameter routes

// @route   POST /api/media/upload-image
// @access  Private (Admin/Editor)
app.post(
  "/api/media/upload-image",
  protect,
  editor,
  (req, res, next) => {
    console.log("📸 Image upload request received");
    console.log("Headers:", req.headers["content-type"]);
    console.log("Body keys:", Object.keys(req.body));

    upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("❌ Image upload error details:", {
          message: err.message,
          code: err.code,
          stack: err.stack,
        });
        return res.status(400).json({
          success: false,
          message: err.message,
          error: err.code || "UPLOAD_ERROR",
        });
      }

      console.log(
        "✅ File received:",
        req.file
          ? {
              filename: req.file.filename,
              size: req.file.size,
              mimetype: req.file.mimetype,
              path: req.file.path,
            }
          : "No file",
      );

      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image uploaded",
        });
      }

      // Generate thumbnail
      const thumbnailUrl = generateThumbnail(req.file.filename);

      res.json({
        success: true,
        url: req.file.path,
        publicId: req.file.filename,
        thumbnail: thumbnailUrl,
        format: req.file.format || "jpg",
        width: req.file.width || 0,
        height: req.file.height || 0,
      });
    } catch (error) {
      console.error("Image upload processing error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

// @route   POST /api/media/delete-upload
// @access  Private (Admin/Editor)
app.post("/api/media/delete-upload", protect, editor, async (req, res) => {
  try {
    const { publicId, type } = req.body;

    if (!publicId) {
      return res.status(400).json({ message: "Public ID is required" });
    }

    console.log(
      `🗑️ Deleting orphaned upload: ${publicId} (${type || "image"})`,
    );

    await deleteFromCloudinary(publicId, type || "image");

    res.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting orphaned upload:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/media/video-link
// @access  Private (Admin/Editor)
// @route   POST /api/media/video-link
// @access  Private (Admin/Editor)
app.post("/api/media/video-link", protect, editor, async (req, res) => {
  try {
    console.log("🎥 Video link request received:", req.body);

    const { eventId, url, title, description, featured } = req.body;

    if (!eventId || !url) {
      return res.status(400).json({
        success: false,
        message: "Please provide eventId and url",
      });
    }

    // Validate eventId format
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Ensure media array exists
    if (!event.media) {
      event.media = [];
    }

    // Extract video info
    const { videoId, platform, thumbnail } = extractVideoInfo(url);

    console.log("Video info extracted:", { videoId, platform, thumbnail });

    if (!videoId || !platform) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid video URL. Only YouTube and Vimeo links are supported.",
      });
    }

    // Create media entry
    const media = await Media.create({
      event: eventId,
      type: "video",
      platform,
      videoId,
      url,
      publicId: `${platform}_${videoId}`,
      thumbnail: {
        url: thumbnail,
        publicId: `${platform}_${videoId}_thumb`,
      },
      title:
        title ||
        `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video`,
      description: description || "",
      format: platform,
      featured: featured || false,
      order: 0,
      uploadedBy: req.user._id,
    });

    // Add to event's media array
    event.media.push(media._id);

    // Update media stats
    if (!event.mediaStats) {
      event.mediaStats = { images: 0, videos: 0, total: 0 };
    }
    event.mediaStats.videos = (event.mediaStats.videos || 0) + 1;
    event.mediaStats.total = (event.mediaStats.total || 0) + 1;

    await event.save();

    console.log("✅ Video link added successfully:", media._id);
    res.status(201).json({
      success: true,
      data: media,
    });
  } catch (error) {
    console.error("❌ Add video link error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.name,
    });
  }
});

// @route   POST /api/media/upload-multiple
// @access  Private (Admin/Editor)
app.post(
  "/api/media/upload-multiple",
  protect,
  editor,
  (req, res, next) => {
    upload.array("images", 20)(req, res, (err) => {
      if (err) {
        console.error("Multiple upload error:", err);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedFiles = [];

      for (const file of req.files) {
        const thumbnailUrl = generateThumbnail(file.filename);
        uploadedFiles.push({
          url: file.path,
          publicId: file.filename,
          thumbnail: thumbnailUrl,
          format: file.format || "jpg",
          width: file.width || 0,
          height: file.height || 0,
        });
      }

      res.json({
        success: true,
        count: uploadedFiles.length,
        files: uploadedFiles,
      });
    } catch (error) {
      console.error("Multiple upload error:", error);
      res.status(500).json({ message: error.message });
    }
  },
);

// @route   GET /api/media/recent
// @access  Private (Admin/Editor)
// ⚠️ THIS MUST COME BEFORE /api/media/:id
app.get("/api/media/recent", protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const media = await Media.find({})
      .populate("event", "eventName")
      .sort("-createdAt")
      .limit(parseInt(limit));

    res.json(media);
  } catch (error) {
    console.error("Get recent media error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/media/event/:eventId
// @access  Public
// ⚠️ THIS MUST COME BEFORE /api/media/:id
app.get("/api/media/event/:eventId", async (req, res) => {
  try {
    // Validate eventId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const media = await Media.find({ event: req.params.eventId }).sort(
      "order createdAt",
    );
    res.json(media);
  } catch (error) {
    console.error("Get media error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/media/reorder
// @access  Private (Admin/Editor)
app.patch("/api/media/reorder", protect, editor, async (req, res) => {
  try {
    const { eventId, mediaOrder } = req.body;

    if (!eventId || !mediaOrder) {
      return res
        .status(400)
        .json({ message: "Please provide eventId and mediaOrder" });
    }

    const bulkOps = mediaOrder.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id, event: eventId },
        update: { $set: { order } },
      },
    }));

    await Media.bulkWrite(bulkOps);

    res.json({ message: "Media reordered successfully" });
  } catch (error) {
    console.error("Reorder media error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/media/video-link
// @access  Private (Admin/Editor)
app.post("/api/media/video-link", protect, editor, async (req, res) => {
  try {
    const { eventId, url, title, description, featured } = req.body;

    if (!eventId || !url) {
      return res
        .status(400)
        .json({ message: "Please provide eventId and url" });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ message: "Invalid URL format" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Extract video info
    const { videoId, platform, thumbnail } = extractVideoInfo(url);

    if (!videoId || !platform) {
      return res.status(400).json({
        message:
          "Invalid video URL. Only YouTube and Vimeo links are supported.",
      });
    }

    // Create media entry
    const media = await Media.create({
      event: eventId,
      type: "video",
      platform,
      videoId,
      url,
      publicId: `${platform}_${videoId}`,
      thumbnail: {
        url: thumbnail,
        publicId: `${platform}_${videoId}_thumb`,
      },
      title:
        title ||
        `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video`,
      description: description || "",
      format: platform,
      featured: featured || false,
      order: 0,
      uploadedBy: req.user._id,
    });

    // Add to event's media array
    event.media.push(media._id);
    await event.save();

    res.status(201).json(media);
  } catch (error) {
    console.error("Add video link error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/media/:id
// @access  Public
// ⚠️ THIS MUST COME AFTER ALL SPECIFIC MEDIA ROUTES
app.get("/api/media/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if it's a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid media ID format",
        error: "The provided ID is not a valid MongoDB ObjectId",
      });
    }

    const media = await Media.findById(id).populate("event", "eventName");

    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }

    res.json(media);
  } catch (error) {
    console.error("Get media error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/media
// @access  Private (Admin/Editor)
app.post("/api/media", protect, editor, async (req, res) => {
  try {
    const {
      eventId,
      type,
      url,
      publicId,
      thumbnail,
      title,
      description,
      duration,
      width,
      height,
      format,
      featured,
      order,
    } = req.body;

    if (!eventId || !type || !url || !publicId) {
      return res
        .status(400)
        .json({ message: "Please provide eventId, type, url, and publicId" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const media = await Media.create({
      event: eventId,
      type,
      url,
      publicId,
      thumbnail: {
        url: thumbnail || url,
        publicId: `${publicId}_thumb`,
      },
      title: title || "Untitled",
      description: description || "",
      duration: duration || "",
      width: width || 0,
      height: height || 0,
      format: format || "",
      featured: featured || false,
      order: order || 0,
      uploadedBy: req.user._id,
    });

    event.media.push(media._id);
    await event.save();

    res.status(201).json(media);
  } catch (error) {
    console.error("Create media error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/media/bulk
// @access  Private (Admin/Editor)
app.post("/api/media/bulk", protect, editor, async (req, res) => {
  try {
    const { eventId, mediaItems } = req.body;

    if (!eventId || !mediaItems || !Array.isArray(mediaItems)) {
      return res
        .status(400)
        .json({ message: "Please provide eventId and mediaItems array" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const createdMedia = [];

    for (const item of mediaItems) {
      const media = await Media.create({
        event: eventId,
        type: item.type || "image",
        url: item.url,
        publicId: item.publicId,
        thumbnail: {
          url: item.thumbnail || item.url,
          publicId: `${item.publicId}_thumb`,
        },
        title: item.title || "Untitled",
        description: item.description || "",
        duration: item.duration || "",
        width: item.width || 0,
        height: item.height || 0,
        format: item.format || "",
        featured: item.featured || false,
        order: item.order || 0,
        uploadedBy: req.user._id,
      });

      createdMedia.push(media);
      event.media.push(media._id);
    }

    await event.save();

    res.status(201).json(createdMedia);
  } catch (error) {
    console.error("Bulk media creation error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/media/:id
// @access  Private (Admin/Editor)
app.put("/api/media/:id", protect, editor, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid media ID format",
      });
    }

    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }

    const { title, description, featured, order } = req.body;

    media.title = title || media.title;
    media.description =
      description !== undefined ? description : media.description;
    media.featured = featured !== undefined ? featured : media.featured;
    media.order = order !== undefined ? order : media.order;

    const updatedMedia = await media.save();
    res.json(updatedMedia);
  } catch (error) {
    console.error("Update media error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/media/:id
// @access  Private (Admin/Editor)
app.delete("/api/media/:id", protect, editor, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid media ID format",
      });
    }

    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }

    // Delete from Cloudinary
    if (media.publicId) {
      await deleteFromCloudinary(
        media.publicId,
        media.type === "video" ? "video" : "image",
      );
    }

    if (media.thumbnail?.publicId) {
      await deleteFromCloudinary(media.thumbnail.publicId);
    }

    // Remove from event
    await Event.findByIdAndUpdate(media.event, {
      $pull: { media: media._id },
    });

    await media.deleteOne();

    res.json({ message: "Media deleted successfully" });
  } catch (error) {
    console.error("Delete media error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// DASHBOARD STATS
// ============================================

// @route   GET /api/stats
// @access  Private
app.get("/api/stats", protect, async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const publishedEvents = await Event.countDocuments({ status: "published" });
    const draftEvents = await Event.countDocuments({ status: "draft" });
    const featuredEvents = await Event.countDocuments({ featured: true });
    const totalMedia = await Media.countDocuments();
    const totalImages = await Media.countDocuments({ type: "image" });
    const totalVideos = await Media.countDocuments({ type: "video" });
    const totalUsers = await User.countDocuments();

    res.json({
      events: {
        total: totalEvents,
        published: publishedEvents,
        draft: draftEvents,
        featured: featuredEvents,
      },
      media: {
        total: totalMedia,
        images: totalImages,
        videos: totalVideos,
      },
      users: totalUsers,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/events
// @access  Private (Admin/Editor)
// @desc    Get all events without status filtering (for admin dashboard)
app.get("/api/admin/events", protect, editor, async (req, res) => {
  try {
    const { limit, status } = req.query;
    const query = {};
    if (status) query.status = status;

    let eventsQuery = Event.find(query)
      .populate({
        path: "media",
        options: { sort: { order: 1, createdAt: 1 } },
      })
      .sort("-createdAt");

    if (limit) {
      eventsQuery = eventsQuery.limit(parseInt(limit));
    }

    const events = await eventsQuery;
    res.json(events);
  } catch (error) {
    console.error("Admin events error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/dashboard
// @access  Private
// @desc    Get all dashboard data in a single endpoint
app.get("/api/dashboard", protect, async (req, res) => {
  try {
    const [
      totalEvents,
      publishedEvents,
      draftEvents,
      featuredEvents,
      totalMedia,
      totalImages,
      totalVideos,
      totalUsers,
      recentEvents,
      recentMedia,
      contactTotal,
      contactNew,
      contactRead,
      contactReplied,
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: "published" }),
      Event.countDocuments({ status: "draft" }),
      Event.countDocuments({ featured: true }),
      Media.countDocuments(),
      Media.countDocuments({ type: "image" }),
      Media.countDocuments({ type: "video" }),
      User.countDocuments(),
      Event.find()
        .populate({
          path: "media",
          options: { sort: { order: 1, createdAt: 1 } },
        })
        .sort("-createdAt")
        .limit(5),
      Media.find({})
        .populate("event", "eventName")
        .sort("-createdAt")
        .limit(10),
      Contact.countDocuments(),
      Contact.countDocuments({ status: "new" }),
      Contact.countDocuments({ status: "read" }),
      Contact.countDocuments({ status: "replied" }),
    ]);

    res.json({
      stats: {
        events: {
          total: totalEvents,
          published: publishedEvents,
          draft: draftEvents,
          featured: featuredEvents,
        },
        media: {
          total: totalMedia,
          images: totalImages,
          videos: totalVideos,
        },
        users: totalUsers,
      },
      recentEvents,
      recentMedia,
      contactStats: {
        total: contactTotal,
        new: contactNew,
        read: contactRead,
        replied: contactReplied,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Add this temporary route to fix existing events
app.post("/api/fix-event-media", protect, admin, async (req, res) => {
  try {
    const { eventId } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Initialize media array if it doesn't exist
    if (!event.media) {
      event.media = [];
    }

    // Initialize mediaStats if it doesn't exist
    if (!event.mediaStats) {
      event.mediaStats = { images: 0, videos: 0, total: 0 };
    }

    await event.save();

    res.json({
      success: true,
      message: "Event fixed successfully",
      event,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Photographer API with Cloudinary is running",
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use(notFound);
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on:`);
  console.log(`   - Local: http://localhost:${PORT}`);
  console.log(`   - Network: http://0.0.0.0:${PORT}`);
  console.log(
    `📸 Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? "Configured" : "Missing config"}`,
  );
  console.log(`🔧 Test endpoint: http://localhost:${PORT}/api/test`);
});

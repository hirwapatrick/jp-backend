import express from "express";
import Tutorial from "../models/Tutorial.js";
import { protect, editor } from "../middleware/auth.js";

const router = express.Router();

const extractVideoInfo = (url) => {
  let videoId = "";
  let platform = "";
  let thumbnail = "";

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "youtube";
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }
    if (videoId) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } else if (url.includes("vimeo.com")) {
    platform = "vimeo";
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) videoId = match[1];
  }

  return { videoId, platform, thumbnail };
};

// @route   GET /api/tutorials
// @access  Public
router.get("/", async (req, res) => {
  try {
    const filter =
      req.query.all === "true" ? {} : { status: "published" };
    const tutorials = await Tutorial.find(filter)
      .sort({ featured: -1, order: 1, createdAt: -1 })
      .select("-__v");
    res.json({ success: true, data: tutorials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/tutorials/:id
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const tutorial = await Tutorial.findById(req.params.id).select("-__v");
    if (!tutorial) {
      return res
        .status(404)
        .json({ success: false, message: "Tutorial not found" });
    }
    res.json({ success: true, data: tutorial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/tutorials
// @access  Private (Admin/Editor)
router.post("/", protect, editor, async (req, res) => {
  try {
    const { title, description, videoUrl, tags, duration, order, featured, status } = req.body;

    if (!title || !videoUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Title and video URL are required" });
    }

    const { videoId, platform, thumbnail } = extractVideoInfo(videoUrl);

    const tutorial = await Tutorial.create({
      title,
      description,
      videoUrl,
      platform,
      videoId,
      thumbnail,
      tags: tags || [],
      duration,
      order: order || 0,
      featured: featured || false,
      status: status || "draft",
      uploadedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: tutorial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/tutorials/:id
// @access  Private (Admin/Editor)
router.put("/:id", protect, editor, async (req, res) => {
  try {
    const { title, description, videoUrl, tags, duration, order, featured, status } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags) updateData.tags = tags;
    if (duration !== undefined) updateData.duration = duration;
    if (order !== undefined) updateData.order = order;
    if (featured !== undefined) updateData.featured = featured;
    if (status) updateData.status = status;

    if (videoUrl) {
      const { videoId, platform, thumbnail } = extractVideoInfo(videoUrl);
      updateData.videoUrl = videoUrl;
      updateData.videoId = videoId;
      updateData.platform = platform;
      updateData.thumbnail = thumbnail;
    }

    const tutorial = await Tutorial.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!tutorial) {
      return res
        .status(404)
        .json({ success: false, message: "Tutorial not found" });
    }

    res.json({ success: true, data: tutorial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/tutorials/:id
// @access  Private (Admin/Editor)
router.delete("/:id", protect, editor, async (req, res) => {
  try {
    const tutorial = await Tutorial.findByIdAndDelete(req.params.id);
    if (!tutorial) {
      return res
        .status(404)
        .json({ success: false, message: "Tutorial not found" });
    }
    res.json({ success: true, message: "Tutorial deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/tutorials/:id/featured
// @access  Private (Admin/Editor)
router.patch("/:id/featured", protect, editor, async (req, res) => {
  try {
    const tutorial = await Tutorial.findById(req.params.id);
    if (!tutorial) {
      return res
        .status(404)
        .json({ success: false, message: "Tutorial not found" });
    }
    tutorial.featured = !tutorial.featured;
    await tutorial.save();
    res.json({ success: true, data: tutorial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/tutorials/:id/like
// @access  Public (tracks by deviceId)
router.post("/:id/like", async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res
        .status(400)
        .json({ success: false, message: "Device ID is required" });
    }

    const tutorial = await Tutorial.findById(req.params.id);
    if (!tutorial) {
      return res
        .status(404)
        .json({ success: false, message: "Tutorial not found" });
    }

    const alreadyLiked = tutorial.likedBy.includes(deviceId);

    if (alreadyLiked) {
      tutorial.likedBy = tutorial.likedBy.filter((id) => id !== deviceId);
      tutorial.likes = Math.max(0, tutorial.likes - 1);
    } else {
      tutorial.likedBy.push(deviceId);
      tutorial.likes += 1;
    }

    await tutorial.save();

    res.json({
      success: true,
      data: { likes: tutorial.likes, liked: !alreadyLiked },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/tutorials/:id/save
// @access  Public (tracks by deviceId)
router.post("/:id/save", async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res
        .status(400)
        .json({ success: false, message: "Device ID is required" });
    }

    const tutorial = await Tutorial.findById(req.params.id);
    if (!tutorial) {
      return res
        .status(404)
        .json({ success: false, message: "Tutorial not found" });
    }

    const alreadySaved = tutorial.savedBy.includes(deviceId);

    if (alreadySaved) {
      tutorial.savedBy = tutorial.savedBy.filter((id) => id !== deviceId);
      tutorial.saves = Math.max(0, tutorial.saves - 1);
    } else {
      tutorial.savedBy.push(deviceId);
      tutorial.saves += 1;
    }

    await tutorial.save();

    res.json({
      success: true,
      data: { saves: tutorial.saves, saved: !alreadySaved },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

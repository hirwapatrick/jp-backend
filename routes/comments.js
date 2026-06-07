import express from "express";
import Comment from "../models/Comment.js";

const router = express.Router();

// @route   GET /api/comments/:tutorialId
// @access  Public
router.get("/:tutorialId", async (req, res) => {
  try {
    const comments = await Comment.find({
      tutorial: req.params.tutorialId,
      parentComment: null,
      isApproved: true,
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    const commentIds = comments.map((c) => c._id);
    const replies = await Comment.find({
      parentComment: { $in: commentIds },
      isApproved: true,
    })
      .sort({ createdAt: 1 })
      .select("-__v");

    const replyMap = {};
    replies.forEach((reply) => {
      const parentId = reply.parentComment.toString();
      if (!replyMap[parentId]) replyMap[parentId] = [];
      replyMap[parentId].push(reply);
    });

    const commentsWithReplies = comments.map((comment) => ({
      ...comment.toObject(),
      replies: replyMap[comment._id.toString()] || [],
    }));

    res.json({ success: true, data: commentsWithReplies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/comments/:tutorialId
// @access  Public
router.post("/:tutorialId", async (req, res) => {
  try {
    const { authorName, text, parentCommentId } = req.body;

    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment text is required" });
    }

    if (parentCommentId) {
      const parentExists = await Comment.findById(parentCommentId);
      if (!parentExists) {
        return res
          .status(404)
          .json({ success: false, message: "Parent comment not found" });
      }
    }

    const comment = await Comment.create({
      tutorial: req.params.tutorialId,
      parentComment: parentCommentId || null,
      authorName: authorName?.trim() || "Anonymous",
      text: text.trim(),
    });

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/comments/:id/like
// @access  Public (tracks by deviceId)
router.post("/:id/like", async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res
        .status(400)
        .json({ success: false, message: "Device ID is required" });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const alreadyLiked = comment.likedBy.includes(deviceId);

    if (alreadyLiked) {
      comment.likedBy = comment.likedBy.filter((id) => id !== deviceId);
      comment.likes = Math.max(0, comment.likes - 1);
    } else {
      comment.likedBy.push(deviceId);
      comment.likes += 1;
    }

    await comment.save();

    res.json({
      success: true,
      data: { likes: comment.likes, liked: !alreadyLiked },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/comments/:id
// @access  Public
router.get("/single/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id).select("-__v");
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    res.json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/comments/:id
// @access  Public
router.delete("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    comment.isApproved = false;
    await comment.save();

    res.json({ success: true, message: "Comment removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

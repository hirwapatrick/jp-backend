import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    tutorial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tutorial',
      required: true,
      index: true,
    },

    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },

    authorName: {
      type: String,
      default: 'Anonymous',
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },

    likes: {
      type: Number,
      default: 0,
    },

    likedBy: {
      type: [String],
      default: [],
    },

    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ tutorial: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

export default mongoose.model('Comment', commentSchema);

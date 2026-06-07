import mongoose from 'mongoose';

const tutorialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      default: '',
    },

    videoUrl: {
      type: String,
      required: [true, 'Please add a video URL'],
    },

    platform: {
      type: String,
      enum: ['youtube', 'vimeo', null],
      default: null,
    },

    videoId: {
      type: String,
      default: null,
    },

    thumbnail: {
      type: String,
      default: '',
    },

    tags: {
      type: [String],
      default: [],
    },

    duration: {
      type: String,
      default: '',
    },

    order: {
      type: Number,
      default: 0,
    },

    featured: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    likes: {
      type: Number,
      default: 0,
    },

    likedBy: {
      type: [String],
      default: [],
    },

    saves: {
      type: Number,
      default: 0,
    },

    savedBy: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

tutorialSchema.index({ status: 1, order: 1 });
tutorialSchema.index({ featured: 1 });
tutorialSchema.index({ createdAt: -1 });

export default mongoose.model('Tutorial', tutorialSchema);

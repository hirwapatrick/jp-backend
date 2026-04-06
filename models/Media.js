import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ['image', 'video', 'link'],
      required: true
    },

    // For Cloudinary uploaded files
    url: {
      type: String,
      required: true
    },

    publicId: {
      type: String,
      required: true
    },

    thumbnail: {
      url: String,
      publicId: String
    },

    // For external video links (YouTube, Vimeo)
    platform: {
      type: String,
      enum: ['youtube', 'vimeo', 'cloudinary', null],
      default: null
    },

    videoId: {
      type: String,
      default: null
    },

    title: {
      type: String,
      default: 'Untitled'
    },

    description: {
      type: String,
      default: ''
    },

    duration: {
      type: String,
      default: ''
    },

    width: {
      type: Number,
      default: 0
    },

    height: {
      type: Number,
      default: 0
    },

    format: {
      type: String,
      default: ''
    },

    featured: {
      type: Boolean,
      default: false
    },

    order: {
      type: Number,
      default: 0
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better performance
mediaSchema.index({ event: 1, order: 1 });
mediaSchema.index({ featured: 1 });
mediaSchema.index({ createdAt: -1 });

export default mongoose.model('Media', mediaSchema);
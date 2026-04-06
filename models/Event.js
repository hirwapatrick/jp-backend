import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: 120
    },

    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
      enum: ['wedding', 'portrait', 'commercial', 'event', 'fashion', 'product', 'other'],
      default: 'other'
    },

    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: 120
    },

    date: {
      type: Date,
      required: [true, 'Event date is required']
    },

    coverImage: {
      url: {
        type: String,
        default: ''
      },
      publicId: {
        type: String,
        default: ''
      },
      thumbnail: {
        type: String,
        default: ''
      }
    },

    description: {
      type: String,
      default: '',
      maxlength: 2000
    },

    clientName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120
    },

    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },

    clientPhone: {
      type: String,
      trim: true
    },

    tags: [
      {
        type: String,
        trim: true
      }
    ],

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },

    featured: {
      type: Boolean,
      default: false
    },

    // REAL media array (stored in database)
    media: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media'
    }],

    // Media statistics - cached counts for performance
    mediaStats: {
      images: {
        type: Number,
        default: 0
      },
      videos: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      }
    },

    // SEO and metadata
    slug: {
      type: String,
      unique: true,
      sparse: true
    },

    metaTitle: {
      type: String,
      trim: true,
      maxlength: 60
    },

    metaDescription: {
      type: String,
      trim: true,
      maxlength: 160
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // For event galleries
    settings: {
      allowDownloads: {
        type: Boolean,
        default: false
      },
      password: {
        type: String,
        default: null
      },
      expiresAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* ----------------------------------
   Indexes for performance
----------------------------------- */
eventSchema.index({ status: 1 });
eventSchema.index({ featured: 1 });
eventSchema.index({ date: -1 });
eventSchema.index({ slug: 1 });
eventSchema.index({ eventType: 1 });
eventSchema.index({ 'settings.expiresAt': 1 }, { expireAfterSeconds: 0 });

/* ----------------------------------
   Virtual populate (media) with sorting
   (This is an alternative way to get media, 
    but we'll keep it for backward compatibility)
----------------------------------- */
eventSchema.virtual('mediaList', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'event',
  options: { sort: { order: 1, createdAt: -1 } }
});

/* ----------------------------------
   Virtual for featured media
----------------------------------- */
eventSchema.virtual('featuredMedia', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'event',
  match: { featured: true },
  options: { sort: { order: 1 } }
});

/* ----------------------------------
   Pre-save middleware to generate slug
----------------------------------- */
eventSchema.pre('save', function(next) {
  if (this.eventName && (!this.slug || this.isModified('eventName'))) {
    this.slug = this.eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

/* ----------------------------------
   Method to update media statistics
----------------------------------- */
eventSchema.methods.updateMediaStats = async function() {
  const stats = await mongoose.model('Media').aggregate([
    { $match: { event: this._id } },
    { 
      $group: {
        _id: null,
        total: { $sum: 1 },
        images: { 
          $sum: { 
            $cond: [{ $in: ['$type', ['image', 'link']] }, 1, 0] 
          } 
        },
        videos: { 
          $sum: { 
            $cond: [{ $eq: ['$type', 'video'] }, 1, 0] 
          } 
        }
      }
    }
  ]);

  if (stats.length > 0) {
    this.mediaStats = stats[0];
  } else {
    this.mediaStats = { images: 0, videos: 0, total: 0 };
  }
  
  return this.save();
};

/* ----------------------------------
   Static method to get events with media counts
----------------------------------- */
eventSchema.statics.getWithMediaCounts = async function(query = {}) {
  return this.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'media',
        localField: '_id',
        foreignField: 'event',
        as: 'mediaList'
      }
    },
    {
      $addFields: {
        mediaCount: { $size: '$mediaList' },
        imageCount: {
          $size: {
            $filter: {
              input: '$mediaList',
              as: 'media',
              cond: { $in: ['$$media.type', ['image', 'link']] }
            }
          }
        },
        videoCount: {
          $size: {
            $filter: {
              input: '$mediaList',
              as: 'media',
              cond: { $eq: ['$$media.type', 'video'] }
            }
          }
        }
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
};

/* ----------------------------------
   Cascade delete media if event removed
----------------------------------- */
eventSchema.pre('deleteOne', { document: true }, async function (next) {
  const mediaCount = await mongoose.model('Media').countDocuments({ event: this._id });
  
  if (mediaCount > 0) {
    console.log(`🗑️ Deleting ${mediaCount} media items for event: ${this._id}`);
    await mongoose.model('Media').deleteMany({ event: this._id });
  }
  
  next();
});

/* ----------------------------------
   Post-save middleware to update stats
----------------------------------- */
eventSchema.post('save', async function() {
  // Don't await this - let it run in background
  this.updateMediaStats().catch(err => 
    console.error('Failed to update media stats:', err)
  );
});

export default mongoose.model('Event', eventSchema);
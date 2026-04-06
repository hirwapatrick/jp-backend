import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// ✅ EXPORT cloudinary directly
export { cloudinary };

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// SIMPLIFIED: Single storage configuration like the working example
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'photographer-portfolio/events',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'limit' }]
  }
});

// Create the upload middleware - SIMPLE, like the working example
export const upload = multer({ storage });

// For backwards compatibility
export const uploadImage = upload;
export const uploadVideo = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'photographer-portfolio/videos',
      resource_type: 'video',
      allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
    }
  })
});

// Simple error handler
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Helper function to delete from Cloudinary
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return null;
  }
};

// Helper function to generate thumbnail
export const generateThumbnail = (publicId) => {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    width: 400,
    height: 400,
    crop: 'fill',
    fetch_format: 'auto',
    quality: 'auto'
  });
};
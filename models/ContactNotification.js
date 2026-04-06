import mongoose from 'mongoose';

const contactNotificationSchema = new mongoose.Schema({
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  
  emailSent: {
    type: Boolean,
    default: false
  },
  
  emailError: {
    type: String,
    default: null
  },
  
  sentAt: {
    type: Date
  },
  
  // For tracking if admin has seen this notification
  adminNotified: {
    type: Boolean,
    default: false
  },
  
  adminNotifiedAt: {
    type: Date
  },
  
  // Notification type
  type: {
    type: String,
    enum: ['new-contact', 'reply-sent', 'reminder'],
    default: 'new-contact'
  }
}, {
  timestamps: true
});

export default mongoose.model('ContactNotification', contactNotificationSchema);
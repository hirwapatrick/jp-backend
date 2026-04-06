import express from 'express';
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTE - Submit contact form
// ============================================
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      eventDate,
      eventType,
      message,
    } = req.body;

    // Validate required fields
    if (!name || !email || !eventType || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, event type, and message'
      });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Create contact entry
    const contact = await Contact.create({
      name,
      email,
      phone: phone || '',
      eventDate: eventDate || '',
      eventType,
      message,
    });

    console.log(`📧 New contact form submission from: ${name} (${email})`);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully!',
      data: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        createdAt: contact.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again.'
    });
  }
});

// ============================================
// ADMIN ROUTES - Protected
// ============================================

// @route   GET /api/contact
// @access  Private/Admin
// @desc    Get all contact submissions
router.get('/', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get contacts
    const contacts = await Contact.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum);

    const total = await Contact.countDocuments(query);

    // Get counts for stats
    const totalCount = await Contact.countDocuments();
    const newCount = await Contact.countDocuments({ status: 'new' });
    const readCount = await Contact.countDocuments({ status: 'read' });
    const repliedCount = await Contact.countDocuments({ status: 'replied' });

    res.json({
      success: true,
      data: contacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      stats: {
        total: totalCount,
        new: newCount,
        read: readCount,
        replied: repliedCount
      }
    });

  } catch (error) {
    console.error('❌ Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/contact/:id
// @access  Private/Admin
// @desc    Get single contact submission
router.get('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID format'
      });
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Mark as read if it was new
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }

    res.json({
      success: true,
      data: contact
    });

  } catch (error) {
    console.error('❌ Get contact error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PATCH /api/contact/:id/status
// @access  Private/Admin
// @desc    Update contact status
router.patch('/:id/status', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID format'
      });
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Update fields
    if (status) contact.status = status;
    if (adminNotes !== undefined) contact.adminNotes = adminNotes;
    
    // If marking as replied, track when
    if (status === 'replied' && contact.status !== 'replied') {
      contact.repliedAt = new Date();
    }

    await contact.save();

    res.json({
      success: true,
      message: 'Contact updated successfully',
      data: contact
    });

  } catch (error) {
    console.error('❌ Update contact error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/contact/:id/reply
// @access  Private/Admin
// @desc    Mark as replied (when admin sends email)
router.post('/:id/reply', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID format'
      });
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Update contact
    contact.status = 'replied';
    contact.repliedAt = new Date();
    
    // Add reply to admin notes
    if (replyMessage) {
      const replyNote = `\n[${new Date().toLocaleString()}] Reply sent: ${replyMessage}`;
      contact.adminNotes = contact.adminNotes 
        ? contact.adminNotes + replyNote
        : replyNote;
    }

    await contact.save();

    // Here you would integrate with your email service
    console.log(`📨 Reply sent to ${contact.email}:`, replyMessage);

    res.json({
      success: true,
      message: 'Reply recorded successfully',
      data: contact
    });

  } catch (error) {
    console.error('❌ Reply to contact error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/contact/:id
// @access  Private/Admin
// @desc    Delete a contact submission
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID format'
      });
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    await contact.deleteOne();

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/contact/bulk
// @access  Private/Admin
// @desc    Bulk delete contacts
router.delete('/bulk', protect, admin, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of contact IDs'
      });
    }

    // Validate all IDs
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

    // Delete contacts
    const result = await Contact.deleteMany({ _id: { $in: validIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} contacts deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('❌ Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/contact/stats/simple
// @access  Private/Admin
// @desc    Get simple contact statistics
router.get('/stats/simple', protect, admin, async (req, res) => {
  try {
    const total = await Contact.countDocuments();
    const newMessages = await Contact.countDocuments({ status: 'new' });
    const readMessages = await Contact.countDocuments({ status: 'read' });
    const repliedMessages = await Contact.countDocuments({ status: 'replied' });

    // Get recent 5 contacts
    const recent = await Contact.find()
      .sort('-createdAt')
      .limit(5)
      .select('name email eventType status createdAt');

    res.json({
      success: true,
      data: {
        total,
        new: newMessages,
        read: readMessages,
        replied: repliedMessages,
        recent
      }
    });

  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/contact/export/csv
// @access  Private/Admin
// @desc    Export contacts to CSV
router.get('/export/csv', protect, admin, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const contacts = await Contact.find(query).sort('-createdAt');

    // Create CSV
    const headers = ['Name', 'Email', 'Phone', 'Event Type', 'Event Date', 'Message', 'Status', 'Received', 'Replied At'];
    const csvRows = [headers.join(',')];

    for (const contact of contacts) {
      const row = [
        `"${contact.name || ''}"`,
        `"${contact.email || ''}"`,
        `"${contact.phone || ''}"`,
        `"${contact.eventType || ''}"`,
        `"${contact.eventDate || ''}"`,
        `"${contact.message.replace(/"/g, '""')}"`,
        contact.status,
        contact.createdAt.toISOString(),
        contact.repliedAt ? contact.repliedAt.toISOString() : ''
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(csv);

  } catch (error) {
    console.error('❌ Export error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
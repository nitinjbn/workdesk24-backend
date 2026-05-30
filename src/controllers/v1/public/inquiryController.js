const { Inquiry } = require('../../../models');
const EmailService = require('../../../services/emailService');
const ApiResponse = require('../../../utils/response');

const inquiryController = {
  async create(req, res) {
    try {
      const { name, email, phone, subject, message } = req.body;

      if (!name || !email || !subject || !message) {
        return ApiResponse.badRequest(res, 'All required fields must be provided');
      }

      const inquiry = await Inquiry.create({
        name,
        email,
        phone,
        subject,
        message,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      await EmailService.sendInquiryNotification(inquiry);
      await EmailService.sendInquiryConfirmation(inquiry);

      return ApiResponse.created(res, {
        id: inquiry.id,
        message: 'Your inquiry has been submitted successfully. We will get back to you soon.',
      }, 'Inquiry submitted successfully');
    } catch (error) {
      console.error('Inquiry creation error:', error);
      return ApiResponse.serverError(res, 'Failed to submit inquiry');
    }
  },
};

module.exports = inquiryController;

const { cloudinary } = require('../config/cloudinary');

/**
 * Delete a file from Cloudinary
 * @param {String} publicId - Public ID of the file
 * @param {String} resourceType - Type of resource (image, raw, video)
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'raw') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate a signed URL for secure access
 * @param {String} publicId - Public ID of the file
 * @param {Object} options - URL options
 * @returns {String} - Signed URL
 */
const generateSignedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
    ...options
  });
};

module.exports = {
  deleteFromCloudinary,
  generateSignedUrl
};

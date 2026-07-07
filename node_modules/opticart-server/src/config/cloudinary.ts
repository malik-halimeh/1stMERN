import { v2 as cloudinary } from 'cloudinary';

// Cloudinary configuration from environment URI or individual keys
const configureCloudinary = () => {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  if (cloudinaryUrl && cloudinaryUrl !== 'cloudinary://mock') {
    // Cloudinary automatically picks up CLOUDINARY_URL env var if loaded.
    console.log('Cloudinary service successfully configured via environment URI.');
  } else {
    console.warn('Cloudinary API credentials missing or set to mock. Running Cloudinary in mock mode.');
  }
};

configureCloudinary();

interface UploadResult {
  url: string;
  publicId: string;
}

// Upload buffer stream helper
export const uploadImageBuffer = async (
  fileBuffer: Buffer,
  folderName: string = 'products'
): Promise<UploadResult> => {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  // Run mock upload if configured in mock mode
  if (!cloudinaryUrl || cloudinaryUrl === 'cloudinary://mock') {
    const mockId = `mock_img_${Math.random().toString(36).substr(2, 9)}`;
    return {
      url: `https://res.cloudinary.com/mock-cloud/image/upload/v1234567/${folderName}/${mockId}.png`,
      publicId: `${folderName}/${mockId}`,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Upload to Cloudinary returned empty result.'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export default cloudinary;

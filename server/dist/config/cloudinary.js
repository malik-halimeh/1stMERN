import { v2 as cloudinary } from 'cloudinary';
// Cloudinary configuration from environment URI or individual keys
const configureCloudinary = () => {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (cloudinaryUrl && cloudinaryUrl !== 'cloudinary://mock') {
        // Cloudinary automatically picks up CLOUDINARY_URL env var if loaded.
        console.log('Cloudinary service successfully configured via environment URI.');
    }
    else {
        console.warn('Cloudinary API credentials missing or set to mock. Running Cloudinary in mock mode.');
    }
};
configureCloudinary();
// Upload buffer stream helper
export const uploadImageBuffer = async (fileBuffer, folderName = 'products') => {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    // Run mock upload if configured in mock mode
    if (!cloudinaryUrl || cloudinaryUrl === 'cloudinary://mock') {
        const mockId = `mock_img_${Math.random().toString(36).substr(2, 9)}`;
        return {
            url: `https://res.cloudinary.com/mock-cloud/image/upload/v1234567/${folderName}/${mockId}.png`,
            publicId: `${folderName}/${mockId}`,
        };
    }
    // The SDK snapshots process.env into its config the first time it is
    // touched. If this module was imported before the environment was loaded
    // (any entrypoint that doesn't import 'dotenv/config' first), that snapshot
    // is empty — force a re-read so the real credentials apply.
    if (!cloudinary.config().api_key) {
        cloudinary.config(true);
    }
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder: folderName }, (error, result) => {
            if (error || !result) {
                return reject(error || new Error('Upload to Cloudinary returned empty result.'));
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
            });
        });
        uploadStream.end(fileBuffer);
    });
};
export default cloudinary;

import mongoose from 'mongoose';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/opticart';
const RETRY_LIMIT = 5;
const RETRY_INTERVAL_MS = 5000;
let connectionAttempts = 0;
const connectDB = async () => {
    const options = {
        maxPoolSize: 10, // Enforce pooling
        autoIndex: true, // Auto-build schema-level indexes
    };
    try {
        mongoose.connection.on('connected', () => {
            console.log('Mongoose connection established successfully to MongoDB.');
            connectionAttempts = 0; // Reset counter
        });
        mongoose.connection.on('error', (err) => {
            console.error(`Mongoose connection error: ${err.message}`);
        });
        mongoose.connection.on('disconnected', () => {
            console.warn('Mongoose disconnected. Attempting to reconnect...');
            handleReconnect();
        });
        await mongoose.connect(MONGO_URI, options);
    }
    catch (error) {
        console.error(`Failed to connect to MongoDB initially: ${error instanceof Error ? error.message : error}`);
        handleReconnect();
    }
};
const handleReconnect = () => {
    if (connectionAttempts < RETRY_LIMIT) {
        connectionAttempts++;
        console.log(`Retrying database connection in ${RETRY_INTERVAL_MS / 1000}s... (Attempt ${connectionAttempts}/${RETRY_LIMIT})`);
        setTimeout(async () => {
            try {
                await mongoose.connect(MONGO_URI);
            }
            catch (err) {
                console.error(`Reconnection attempt ${connectionAttempts} failed.`);
            }
        }, RETRY_INTERVAL_MS);
    }
    else {
        console.error('Critical Error: MongoDB reconnection limit exceeded. Exiting server process.');
        process.exit(1);
    }
};
export default connectDB;

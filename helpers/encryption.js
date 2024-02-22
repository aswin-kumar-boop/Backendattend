const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const secretKey = process.env.ENCRYPTION_KEY; // Ensure this key is securely generated and stored
const iv = crypto.randomBytes(16); // Initialization vector

// Function to encrypt text
exports.encrypt = (text) => {
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

// Function to decrypt text
exports.decrypt = (text) => {
    const [ivHex, encryptedText] = text.split(':');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), Buffer.from(ivHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, 'hex')), decipher.final()]);

    return decrypted.toString();
};

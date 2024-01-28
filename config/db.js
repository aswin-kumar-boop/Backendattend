require('dotenv').config(); // This loads the environment variables from the .env file
console.log("MongoDB URI:", process.env.MONGO_URI); // This line will log the MongoDB URI

const mongoose = require('mongoose');

const connectionString = process.env.MONGO_URI;

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.connect(connectionString, options)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });

module.exports = mongoose;

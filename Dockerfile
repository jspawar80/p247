# Use the official Node.js 16 image as the base image
FROM node:16

# Set the working directory to /app
WORKDIR /app

# Copy the package.json and package-lock.json files to /app
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code to /app
COPY . .

# Expose port 3000 to the outside world
EXPOSE 3000

# Start the application
CMD [ "npm", "start" ]

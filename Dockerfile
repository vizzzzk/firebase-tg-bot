# 1. Use an official Node.js image as the base
# Use a specific version for consistency, e.g., Node.js 20
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package.json and package-lock.json to the container
# This caches your dependencies for faster subsequent builds
COPY package*.json ./

# 4. Install project dependencies
RUN npm install

# 5. Copy the rest of your application code into the container
COPY . .

# 6. Build your Next.js application for production
# This creates the optimized .next directory
RUN npm run build

# 7. Expose the port that Next.js runs on (default is 3000)
EXPOSE 3000

# 8. Define the command to start the application
# This runs the production server
CMD ["npm", "start"]

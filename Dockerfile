# Use the official Bun image as the base
FROM oven/bun:1 as base

# Set the working directory in the container
WORKDIR /app

# Copy package.json and bun.lockb to install dependencies
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Set environment variables (You'll need to add these in Azure App Service configuration)
# For Dockerfile, we can specify a placeholder here, but actual values should be set in Azure
ARG ENV_FILE
ENV ENV_FILE=${ENV_FILE}

# Expose the port the app runs on
EXPOSE 4050

# Command to run the application with development watch mode
CMD ["bun", "run", "dev"]
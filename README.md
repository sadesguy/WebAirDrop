# WebDrop

WebDrop is a secure peer-to-peer file transfer application that allows users to share files directly between devices over WebRTC. This README provides instructions for setting up and running the application in both development and production environments.

Please consider that this project was made within 12h timer and is just a proof of my learning skills (I've never touched typescript before)  

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Docker](#docker)
- [Environment Variables](#environment-variables)
- [License](#license)

## Getting Started

To get started with WebDrop, clone the repository and install the dependencies.

```bash
git clone https://github.com/sadesguy/webdrop.git
cd webdrop
bun i
```

## Development Setup

1. **Docker Development Environment**:

   - To run the application in development mode using Docker, use the following command:

   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. **Local Development**:

   - You can also run the application locally without Docker. Make sure you have Bun installed, then run:

   ```bash
   bun run dev
   ```

## Production Setup

1. **Docker Production Environment**:

   - To build and run the application in production mode using Docker, use the following command:

   ```bash
   docker-compose up --build
   ```

2. **Building for Production**:

   - To build the application for production, run:

   ```bash
   bun run build
   bun run start:docker
   ```

## Docker

WebDrop provides Docker support for both development and production environments. The Dockerfiles are located in the `docker` directory.

- **Development Dockerfile**: `docker/dev.Dockerfile`
- **Production Dockerfile**: `docker/prod.Dockerfile`

## Environment Variables

Create a `.env` file in the root directory based on the `.env.example` file to set up the necessary environment variables for the application.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

## Disclaimer

Beware that this README and some ui components (i also asked it to write some comments for easier future development) were written with the help of AI, so there might be bugs and stupidity

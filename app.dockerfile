# Use a pre-built image of the Deno runtime
FROM node:18.15.0-alpine

# Set the working directory in the container
WORKDIR /app

SHELL ["/bin/bash", "-c"]

RUN npm install -g npm@latest
RUN npm install -g pnpm@7.25.1
RUN pnpm setup

COPY package.json /app

RUN pnpm install

COPY pnpm-lock.yaml /app
COPY . /app

CMD ["./run.sh"]
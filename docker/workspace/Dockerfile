FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential development tools and languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core tools
    bash \
    curl \
    wget \
    git \
    zip \
    unzip \
    ca-certificates \
    gnupg \
    # Build tools
    build-essential \
    gcc \
    g++ \
    make \
    cmake \
    # Python
    python3 \
    python3-pip \
    python3-venv \
    # Java (OpenJDK 17)
    openjdk-17-jdk-headless \
    # Ruby
    ruby \
    # Go
    golang-go \
    # Editors & utilities
    nano \
    vim-tiny \
    less \
    tree \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for convenience
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Set up workspace directory
WORKDIR /workspace

# Default shell
CMD ["/bin/bash"]

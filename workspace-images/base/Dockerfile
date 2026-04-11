FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential tools
RUN apt-get update && apt-get install -y \
    curl \
    git \
    wget \
    vim \
    nano \
    sudo \
    build-essential \
    python3 \
    python3-pip \
    ripgrep \
    jq \
    tree \
    htop \
    net-tools \
    inotify-tools \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install common global npm packages
RUN npm install -g npm@latest typescript ts-node nodemon

# Create developer user
RUN useradd -m -s /bin/bash -G sudo developer \
    && echo "developer ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Set up nice bash prompt
RUN echo 'export PS1="\[\033[38;5;39m\]orion\[\033[0m\]:\[\033[38;5;214m\]\w\[\033[0m\]\$ "' >> /home/developer/.bashrc \
    && echo 'alias ll="ls -la"' >> /home/developer/.bashrc \
    && echo 'alias la="ls -A"' >> /home/developer/.bashrc

USER developer
WORKDIR /workspace

CMD ["/bin/bash"]

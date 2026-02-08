# Bleu POS System

A comprehensive Point of Sale (POS) system built with modern microservices architecture, featuring blockchain integration for enhanced security and auditability.

## Features

- **Multi-role Support**: Separate interfaces for cashiers, managers, and administrators
- **Real-time Notifications**: WebSocket-based notification system
- **Blockchain Logging**: All critical operations logged to blockchain for audit trails
- **Discount Management**: Flexible discount and promotion system
- **Inventory Integration**: Automatic inventory deduction on sales
- **Receipt Generation**: Automated receipt creation and management
- **Session Management**: Cashier session tracking and reporting
- **Waste Tracking**: Monitor and report waste/spillage incidents

## Architecture

The system consists of multiple microservices:
- **Sales Services** (Port 9000): Core sales and order processing
- **Blockchain Services** (Port 9005): Activity logging to blockchain
- **Discount Services** (Port 7003): Discount and promotion management
- **Notification Services** (Port 9004): Real-time notifications
- **Receipt Services** (Port 9003): Receipt generation
- **Session Services** (Port 9001): Cashier session management
- **Waste Services** (Port 9002): Waste tracking
- **Frontend**: React-based web interface

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bleu-pos
   ```

2. **Follow the setup guide**
   See [Setup and Installation](./docs/setup-installation.md) for detailed instructions.

3. **Start the system**
   ```bash
   # Start all services (using docker-compose recommended)
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API Documentation: http://localhost:9000/docs

## Documentation

📚 **[Complete Documentation](./docs/)**

- **[User Guide](./docs/user-guide.md)**: How to use the POS system
- **[Developer Guide](./docs/developer-guide.md)**: Architecture and development information
- **[API Reference](./docs/api-reference.md)**: Complete API documentation
- **[Setup Guide](./docs/setup-installation.md)**: Installation and deployment instructions

## Technology Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React.js
- **Database**: SQL Server
- **Blockchain**: BuildBear
- **Authentication**: JWT
- **Communication**: REST APIs, WebSockets

## Branching and Merging Strategies

A feature-based branching strategy is implemented to support collaborative development:

| Process/Branch Type | Description |
|---------------------|-------------|
| Master Branch | The default and primary integration branch containing the current development state. Serves as the central hub where approved feature work is merged. Direct commits are discouraged to maintain code stability. |
| Feature Branches | Used for developing new system functionalities and updates. Created from master and merged back through pull requests. Current active branches: `updated-updatePOS`, `jesaile`, `updated-pos`. |
| Developer Workflow | Developers create feature branches from master for specific functionalities, then submit pull requests to merge changes back into master after completion and testing. |

### Pull Request and Review Process
All changes are integrated into the master branch through pull requests (e.g., PR #10, PR #9). Pull requests undergo code review to ensure quality, maintainability, and adherence to project standards before approval and merge.

### Push Process
Developers push commits to their feature branches with descriptive commit messages to ensure traceability of changes. Each commit represents a logical unit of work.

### Code Review and Validation
Pull requests undergo peer review, validation against system requirements, and testing for functionality and compatibility before being approved for merge into master.

### Merge to Master Branch
Approved pull requests are merged into the master branch after successful validation. Recent example: Pull request #10 from `DASH1324/updated-updatePOS` was successfully merged last month.

**Current Repository Status:**
- Total commits: 104
- Active branches: 4 (master, updated-updatePOS, jesaile, updated-pos)
- Contributors: 4 developers
- Repository: GitHub (DASH1324/POS)

## Tagging Strategy

Tags will be used to mark stable code snapshots and version releases following Semantic Versioning principles.

### Tag Format
`v<major>.<minor>.<patch>`
Example: v1.0.0

### Definition of Version Levels
- **Major**: Breaking changes, major architecture updates, or new major modules that are incompatible with previous versions
- **Minor**: New features added without breaking existing functionality (backward-compatible)
- **Patch**: Bug fixes, security patches, small improvements, and performance enhancements

### Implementation Plan
**Current Status:** One version tag exists in the repository (v1.0.0), indicating the first major release.

**Future Implementation:**
- Additional tags will be applied to commits in the master branch after validation by the QA team
- Subsequent tags will follow the semantic versioning format (e.g., v1.1.0 for minor updates)
- Each tag will include release notes documenting changes, new features, and bug fixes
- Tags will mark stable snapshots suitable for deployment

### Tag Application Process
1. Code must be thoroughly tested and validated by QA team
2. Tags are applied exclusively to master branch commits
3. Annotated tags will include metadata (tagger, date, release message)
4. Release documentation accompanies each tagged version

## Contributing

Please read our [Developer Guide](./docs/developer-guide.md) for information on:
- Development environment setup
- Code standards and best practices
- Testing guidelines
- Pull request process

## License

[Specify your license here]

## Support

For support and questions:
- 📖 Check the [documentation](./docs/)
- 🐛 Report issues on GitHub
- 💬 Contact the development team

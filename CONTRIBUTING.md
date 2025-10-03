# Contributing to WebSocket API Server

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the WebSocket API Server project.

---

## 🤝 How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

**Good bug reports include:**
- Clear, descriptive title
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node.js version, etc.)
- Relevant logs or error messages
- Screenshots if applicable

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:
- Clear description of the enhancement
- Use cases and benefits
- Potential implementation approach
- Examples of similar features elsewhere

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow coding standards
   - Add tests if applicable
   - Update documentation
   - Keep commits focused and atomic

4. **Test your changes**
   ```bash
   npm test  # if tests exist
   npm start # manual testing
   ```

5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add support for custom message handlers"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**
   - Provide clear description
   - Reference related issues
   - Include testing steps

---

## 📝 Coding Standards

### JavaScript Style Guide

- Use ES6+ features
- Use async/await over callbacks
- Use const/let, not var
- Use descriptive variable names
- Add JSDoc comments for functions
- Keep functions small and focused

### Example

```javascript
/**
 * Register a new message handler
 * @param {string} type - Message type
 * @param {Function} handler - Handler function
 * @returns {void}
 */
function registerHandler(type, handler) {
  if (!type || typeof handler !== 'function') {
    throw new Error('Invalid handler registration');
  }
  
  this.handlers.set(type, handler);
  logger.debug('Handler registered', { type });
}
```

### File Organization

- One main export per file
- Group related functionality
- Keep files under 500 lines
- Use clear, descriptive filenames

### Error Handling

- Always handle errors
- Use try-catch for async operations
- Log errors with context
- Return meaningful error messages

```javascript
try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed', { 
    error: error.message,
    context: 'additional context'
  });
  throw error;
}
```

---

## 🧪 Testing Guidelines

### Manual Testing

1. Start the server
2. Use the demo interface at `/demo.html`
3. Test all message types
4. Verify error handling
5. Check logs for errors

### Test Checklist

- [ ] Connection establishment
- [ ] Authentication (JWT and API key)
- [ ] Message routing
- [ ] Broadcasting
- [ ] Direct messaging
- [ ] Inference requests
- [ ] Error handling
- [ ] Rate limiting
- [ ] Graceful shutdown

---

## 📚 Documentation

### Update Documentation

When adding features, update:
- README.md (if user-facing)
- API-REFERENCE.md (for new message types)
- ARCHITECTURE.md (for architectural changes)
- Code comments

### Documentation Style

- Use clear, simple language
- Include code examples
- Provide context and use cases
- Keep formatting consistent

---

## 🔀 Commit Message Guidelines

Use conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding tests
- **chore**: Maintenance tasks

### Examples

```
feat(router): add support for custom middleware

Add ability to register middleware functions that run
before message handlers. This enables authentication,
logging, and validation plugins.

Closes #123
```

```
fix(broker): handle Redis connection failures gracefully

Previously, Redis connection failures would crash the server.
Now failures are logged and the broker attempts to reconnect.

Fixes #456
```

---

## 🏗️ Development Setup

### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/websocket-api-server.git
cd websocket-api-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit configuration
nano .env
```

### Running in Development

```bash
# Start with auto-reload
npm run dev

# Or start normally
npm start
```

### Optional: Redis Setup

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:alpine
```

---

## 🐛 Debugging

### Enable Debug Logging

```env
LOG_LEVEL=debug
```

### View Logs

```bash
# File logs
tail -f logs/app.log

# PM2 logs
pm2 logs websocket-api-server
```

### Debug with Node Inspector

```bash
node --inspect src/server.js
```

Then open Chrome DevTools at `chrome://inspect`

---

## 📦 Adding Dependencies

### Before Adding Dependencies

- Verify the package is actively maintained
- Check for security vulnerabilities
- Consider bundle size impact
- Look for simpler alternatives

### Adding a Dependency

```bash
npm install package-name
```

Update documentation if the dependency:
- Requires configuration
- Changes setup process
- Affects deployment

---

## 🚀 Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create git tag
4. Push to repository
5. Create GitHub release

---

## 🤔 Questions?

- Check existing issues
- Review documentation
- Ask in discussions
- Contact maintainers

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🙏

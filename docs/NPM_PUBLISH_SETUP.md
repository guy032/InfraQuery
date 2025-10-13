# NPM Publishing Setup Guide

This guide will help you set up automated npm publishing for InfraQuery using GitHub Actions.

## Prerequisites

1. An npm account (create one at [npmjs.com](https://www.npmjs.com/signup))
2. Access to the GitHub repository settings

## Setup Steps

### 1. Create an NPM Access Token

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Click on your profile picture → **Access Tokens**
3. Click **Generate New Token** → **Classic Token**
4. Select **Automation** type (for CI/CD usage)
5. Give it a descriptive name like "InfraQuery GitHub Actions"
6. Copy the token (you won't see it again!)

### 2. Add NPM Token to GitHub Secrets

1. Go to your GitHub repository: https://github.com/maprixcom/InfraQuery
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste the npm token you copied
6. Click **Add secret**

### 3. First Manual Publish (Recommended)

Before the automated workflow kicks in, it's good to do a first manual publish:

```bash
# Make sure everything is built
yarn build

# Login to npm (one-time setup on your machine)
npm login

# Publish the package
npm publish --access public
```

This creates the package on npm. Subsequent publishes will be automated.

## How It Works

### Automated Publishing Workflow

The CI/CD pipeline (`.github/workflows/publish.yml`) will:

1. **Trigger**: Runs on every push to the `main` branch
2. **Build**: Compiles TypeScript and runs type checks
3. **Version Check**: Checks if the version in `package.json` has changed
4. **Publish**: If version changed, publishes to npm
5. **Release**: Creates a GitHub release with the version tag

### Version Management

The workflow only publishes when you **bump the version** in `package.json`:

```bash
# For bug fixes (1.0.0 → 1.0.1)
npm version patch

# For new features (1.0.0 → 1.1.0)
npm version minor

# For breaking changes (1.0.0 → 2.0.0)
npm version major
```

This creates a git commit and tag. Then:

```bash
git push origin main --follow-tags
```

### Continuous Integration

The `.github/workflows/ci.yml` runs on:
- All pull requests to `main`
- Pushes to feature branches

It tests the build across Node.js versions 18, 20, and 22.

## Publishing Workflow

### Standard Release Process

1. Make your changes on a feature branch
2. Create a PR to `main` (CI will run automatically)
3. After PR is merged, bump the version:
   ```bash
   npm version patch -m "Release v%s"
   git push origin main --follow-tags
   ```
4. GitHub Actions will automatically:
   - Build the project
   - Publish to npm
   - Create a GitHub release

### Manual Publish (if needed)

If you need to publish manually:

```bash
yarn build
npm publish
```

## Files Created

- **`.github/workflows/publish.yml`**: Automated npm publishing on push to main
- **`.github/workflows/ci.yml`**: Continuous integration testing
- **`.npmignore`**: Excludes source files and dev files from npm package
- **`package.json`**: Updated with repository info and MPL-2.0 license

## Package Information

- **Package name**: `infraquery`
- **npm URL**: https://www.npmjs.com/package/infraquery
- **Current version**: Check `package.json`
- **License**: MPL-2.0

## Troubleshooting

### "You do not have permission to publish"

- Make sure you're logged in to the correct npm account
- Run `npm login` and verify with `npm whoami`
- Check if someone else has already claimed the package name

### "Version already exists"

- You need to bump the version number in `package.json`
- Use `npm version patch/minor/major`

### GitHub Actions failing

- Check that `NPM_TOKEN` secret is properly set in GitHub
- Verify the token has "Automation" permissions
- Check the Actions logs for specific errors

## Testing Locally

Before pushing, test the build:

```bash
# Clean build
yarn clean && yarn build

# Test the built package
node dist/index.js --help

# Check what files will be published
npm pack --dry-run
```

## Best Practices

1. **Always bump version** before merging to main if you want to publish
2. **Test thoroughly** on feature branches (CI runs automatically on PRs)
3. **Use semantic versioning**: patch for fixes, minor for features, major for breaking changes
4. **Keep a CHANGELOG**: Document changes in each version
5. **Tag releases**: The workflow automatically creates git tags

## Support

For issues or questions:
- Open an issue: https://github.com/maprixcom/InfraQuery/issues
- Check the workflow runs: https://github.com/maprixcom/InfraQuery/actions


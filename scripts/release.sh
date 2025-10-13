#!/bin/bash

# InfraQuery Release Script
# This script helps bump versions and create releases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: You must be on the main branch to create a release${NC}"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: You have uncommitted changes${NC}"
    echo "Please commit or stash your changes before releasing"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"

# Ask for bump type
echo ""
echo "What type of release is this?"
echo "1) patch   - Bug fixes (e.g., $CURRENT_VERSION → $(npm version patch --no-git-tag-version -s && node -p "require('./package.json').version" && git checkout package.json))"
echo "2) minor   - New features (e.g., $CURRENT_VERSION → $(npm version minor --no-git-tag-version -s && node -p "require('./package.json').version" && git checkout package.json))"
echo "3) major   - Breaking changes (e.g., $CURRENT_VERSION → $(npm version major --no-git-tag-version -s && node -p "require('./package.json').version" && git checkout package.json))"
echo "4) custom  - Specify version manually"
echo ""
read -p "Enter choice (1-4): " CHOICE

case $CHOICE in
    1)
        BUMP_TYPE="patch"
        ;;
    2)
        BUMP_TYPE="minor"
        ;;
    3)
        BUMP_TYPE="major"
        ;;
    4)
        read -p "Enter version (e.g., 1.2.3): " CUSTOM_VERSION
        BUMP_TYPE=""
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Bump version
if [ -n "$BUMP_TYPE" ]; then
    NEW_VERSION=$(npm version $BUMP_TYPE --no-git-tag-version)
    NEW_VERSION=${NEW_VERSION#v} # Remove 'v' prefix
else
    npm version $CUSTOM_VERSION --no-git-tag-version
    NEW_VERSION=$CUSTOM_VERSION
fi

echo -e "${GREEN}Bumped version to: $NEW_VERSION${NC}"

# Update CHANGELOG if it exists
if [ -f "CHANGELOG.md" ]; then
    echo ""
    read -p "Would you like to edit CHANGELOG.md? (y/n): " EDIT_CHANGELOG
    if [ "$EDIT_CHANGELOG" = "y" ] || [ "$EDIT_CHANGELOG" = "Y" ]; then
        ${EDITOR:-nano} CHANGELOG.md
    fi
fi

# Commit and tag
echo ""
echo -e "${YELLOW}Creating commit and tag...${NC}"
git add package.json
if [ -f "CHANGELOG.md" ]; then
    git add CHANGELOG.md
fi
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo ""
echo -e "${GREEN}✓ Successfully created release v$NEW_VERSION${NC}"
echo ""
echo "Next steps:"
echo "1. Review the changes: git log -1"
echo "2. Push to GitHub: git push origin main --follow-tags"
echo "3. GitHub Actions will automatically publish to npm"
echo ""
echo -e "${YELLOW}To push now, run:${NC}"
echo "   git push origin main --follow-tags"


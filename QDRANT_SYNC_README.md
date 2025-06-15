# LibreChat Qdrant Sync Tool

This tool synchronizes the LibreChat codebase with a Qdrant vector database, making the code searchable using semantic search capabilities.

## Overview

The `sync-qdrant.js` script:
- Scans the LibreChat repository for code files
- Chunks code into smaller text segments
- Creates embeddings using OpenAI's `text-embedding-3-small` model
- Clears the existing Qdrant collection and uploads new embeddings
- Preserves file paths and chunk metadata for accurate reference

## Prerequisites

- **Node.js 18 or higher** (required for modern JavaScript features and dependencies)
- OpenAI API key
- Qdrant instance (already configured at q.superwebpros.com)

## Setup

1. Install dependencies:

```bash
npm install @qdrant/js-client-rest langchain dotenv
```

Or use the provided dependencies file:

```bash
npm install --package-lock-only sync-qdrant-dependencies.json
```

2. Create or update your `.env` file in the LibreChat root directory:

```
OPENAI_API_KEY=your_openai_api_key
```

## Usage

Run the script from the LibreChat root directory:

```bash
node sync-qdrant.js
```

To test the script without making any changes to the database, use the dry-run mode:

```bash
node sync-qdrant.js --dry-run
```

## Configuration

The script includes the following configuration options at the top of the file:

| Option | Description | Default |
|--------|-------------|---------|
| `QDRANT_URL` | URL of your Qdrant instance | `https://q.superwebpros.com` |
| `QDRANT_API_KEY` | API key for Qdrant access | `5af7fe75-eb75-4a63-ba54-bc17c2b2b45c` |
| `COLLECTION_NAME` | Name of the Qdrant collection | `librechat-code` |
| `EMBEDDING_MODEL` | OpenAI embedding model to use | `text-embedding-3-small` |
| `CHUNK_SIZE` | Size of text chunks in characters | 1000 |
| `CHUNK_OVERLAP` | Overlap between chunks in characters | 100 |
| `INCLUDE_EXTENSIONS` | Array of file extensions to include | Various code file extensions |
| `EXCLUDE_DIRS` | Array of directories to exclude | Common non-code directories |

You can modify these values directly in the script to customize the synchronization process.

## How It Works

1. The script scans the repository for files with specified extensions
2. Each file is read and split into chunks with the RecursiveCharacterTextSplitter
3. Embeddings are generated for each chunk using OpenAI
4. The existing Qdrant collection is cleared
5. New embeddings with metadata are uploaded to Qdrant

## Troubleshooting

### Missing OpenAI API Key

If you see an error about a missing OpenAI API key, make sure you:
- Have created a `.env.qdrant` file in the LibreChat root directory
- Have added your OpenAI API key as `OPENAI_API_KEY=your_key_here`
- Have saved the `.env.qdrant` file

### Node.js Version Issues

If you encounter errors like `ReferenceError: ReadableStream is not defined` or other dependency-related errors:
- Verify you're using Node.js 18 or higher with `node --version`
- If using an older version, consider using nvm to manage Node.js versions:
  ```bash
  # Install nvm (if not already installed)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
  
  # Install and use Node.js 18
  nvm install 18
  nvm use 18
  
  # Then run the script
  node sync-qdrant.js
  ```
- Alternatively, use Docker to run the script in a controlled environment

### Connection Issues

If you encounter connection issues with Qdrant:
- Verify the Qdrant server is running and accessible
- Check that the API key is correct
- Ensure your network allows connections to the Qdrant server

## License

This script is licensed under the same terms as the LibreChat project.
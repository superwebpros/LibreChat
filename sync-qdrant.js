#!/usr/bin/env node

/**
 * Sync LibreChat Repository to Qdrant Vector Store
 *
 * This script syncs the LibreChat code repository to a Qdrant vector store.
 * It clears the existing collection and repopulates it with new embeddings.
 *
 * Usage: node sync-qdrant.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const { QdrantClient } = require('@qdrant/js-client-rest');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const dotenv = require('dotenv');

// Load environment variables from .env.qdrant file if it exists
dotenv.config({ path: path.resolve(__dirname, '.env.qdrant') });

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'https://q.superwebpros.com';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'librechat-code';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '1000', 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '100', 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// File extensions to include
const INCLUDE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.css',
  '.scss',
  '.html',
  '.py',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.rs',
  '.php',
  '.rb',
];

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
  '.husky',
  '.vscode',
  '.github',
];

// Initialize the Qdrant client
const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

// Initialize the OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: OPENAI_API_KEY,
  model: EMBEDDING_MODEL,
});

// Initialize the text splitter
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

/**
 * Check if the OpenAI API key is set
 */
function checkRequiredAPIKeys() {
  if (!OPENAI_API_KEY) {
    console.error(
      '\x1b[31mError: OPENAI_API_KEY is not set. Please set it in your .env.qdrant file or environment variables.\x1b[0m',
    );
    process.exit(1);
  }

  if (!QDRANT_API_KEY) {
    console.error(
      '\x1b[31mError: QDRANT_API_KEY is not set. Please set it in your .env.qdrant file or environment variables.\x1b[0m',
    );
    process.exit(1);
  }
}

/**
 * Check if a directory should be excluded
 * @param {string} dirPath - Directory path
 * @returns {boolean} - True if directory should be excluded
 */
function shouldExcludeDir(dirPath) {
  const dirname = path.basename(dirPath);
  return EXCLUDE_DIRS.includes(dirname);
}

/**
 * Check if a file should be included based on its extension
 * @param {string} filePath - File path
 * @returns {boolean} - True if file should be included
 */
function shouldIncludeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return INCLUDE_EXTENSIONS.includes(ext);
}

/**
 * Recursively get all files in a directory
 * @param {string} dirPath - Directory path
 * @returns {Promise<string[]>} - Array of file paths
 */
async function getFiles(dirPath) {
  let files = [];
  const items = await readdir(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const itemStat = await stat(itemPath);

    if (itemStat.isDirectory()) {
      if (!shouldExcludeDir(itemPath)) {
        const subFiles = await getFiles(itemPath);
        files = [...files, ...subFiles];
      }
    } else if (itemStat.isFile() && shouldIncludeFile(itemPath)) {
      files.push(itemPath);
    }
  }

  return files;
}

/**
 * Read a file and return its content
 * @param {string} filePath - File path
 * @returns {Promise<{path: string, content: string}>} - File content with path
 */
async function readFileContent(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    // Get relative path from repository root
    const relPath = path.relative(path.resolve(__dirname), filePath);
    return {
      path: relPath,
      content,
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Process a file and convert it to chunks with embeddings
 * @param {object} fileData - File data with path and content
 * @returns {Promise<Array>} - Array of document chunks with embeddings
 */
async function processFile(fileData) {
  if (!fileData) return [];

  console.log(`Processing: ${fileData.path}`);

  // Split text into chunks
  const texts = await textSplitter.splitText(fileData.content);

  // Prepare documents with metadata
  const documents = texts.map((text, i) => ({
    pageContent: text,
    metadata: {
      path: fileData.path,
      chunk: i,
      totalChunks: texts.length,
    },
  }));

  return documents;
}

/**
 * Reset the collection (delete and recreate)
 */
async function resetCollection() {
  try {
    console.log(`Checking if collection '${COLLECTION_NAME}' exists...`);

    if (DRY_RUN) {
      console.log('\x1b[33m[DRY RUN]\x1b[0m Would check if collection exists');
      console.log('\x1b[33m[DRY RUN]\x1b[0m Would delete existing collection if it exists');
      console.log('\x1b[33m[DRY RUN]\x1b[0m Would create a new collection with 1536 dimensions');
      return;
    }

    // Check if collection exists
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === COLLECTION_NAME,
    );

    // Delete collection if it exists
    if (collectionExists) {
      console.log(`Deleting existing collection '${COLLECTION_NAME}'...`);
      await qdrantClient.deleteCollection(COLLECTION_NAME);
      console.log('Collection deleted successfully.');
    }

    // Create a new collection
    console.log(`Creating collection '${COLLECTION_NAME}'...`);
    await qdrantClient.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 1536, // Dimensions for text-embedding-3-small
        distance: 'Cosine',
      },
    });
    console.log('Collection created successfully.');
  } catch (error) {
    console.error('Error resetting collection:', error);
    process.exit(1);
  }
}

/**
 * Upload documents to Qdrant
 * @param {Array} documents - Array of documents to upload
 */
async function uploadToQdrant(documents) {
  try {
    console.log(`Uploading ${documents.length} documents to Qdrant...`);

    if (DRY_RUN) {
      console.log('\x1b[33m[DRY RUN]\x1b[0m Would generate embeddings and upload documents');
      console.log('\x1b[33m[DRY RUN]\x1b[0m Would process in batches of 100 documents');
      console.log(`\x1b[33m[DRY RUN]\x1b[0m Would upload ${documents.length} documents total`);
      return;
    }

    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 100;
    let count = 0;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);

      // Get embeddings for the batch
      const texts = batch.map((doc) => doc.pageContent);
      const embeddingResults = await embeddings.embedDocuments(texts);

      // Prepare points for Qdrant
      const points = batch.map((doc, idx) => ({
        id: count + idx,
        vector: embeddingResults[idx],
        payload: {
          text: doc.pageContent,
          metadata: doc.metadata,
        },
      }));

      // Upload batch to Qdrant
      await qdrantClient.upsert(COLLECTION_NAME, {
        points,
      });

      count += batch.length;
      console.log(`Uploaded ${count}/${documents.length} documents...`);
    }

    console.log('Upload completed successfully!');
  } catch (error) {
    console.error('Error uploading to Qdrant:', error);
  }
}

/**
 * Main function to synchronize repository with Qdrant
 */
async function syncRepository() {
  try {
    console.log('Starting LibreChat repository sync to Qdrant...');

    if (DRY_RUN) {
      console.log('\x1b[33m[DRY RUN MODE]\x1b[0m No changes will be made to the vector database');
    }

    // Check if required API keys are set
    checkRequiredAPIKeys();

    // Reset the collection
    await resetCollection();

    // Get all files in the repository
    const repoPath = path.resolve(__dirname);
    console.log(`Scanning repository at: ${repoPath}`);
    const files = await getFiles(repoPath);
    console.log(`Found ${files.length} files to process.`);

    // Read and process all files
    let allDocuments = [];
    for (const file of files) {
      const fileData = await readFileContent(file);
      const documents = await processFile(fileData);
      allDocuments = [...allDocuments, ...documents];
    }

    console.log(`Created ${allDocuments.length} document chunks from ${files.length} files.`);

    // Upload documents to Qdrant
    await uploadToQdrant(allDocuments);

    if (DRY_RUN) {
      console.log('\x1b[33m[DRY RUN]\x1b[0m Repository sync simulation completed');
    } else {
      console.log('\x1b[32mRepository sync completed successfully!\x1b[0m');
    }
  } catch (error) {
    console.error('Error syncing repository:', error);
    process.exit(1);
  }
}

// Run the sync process
syncRepository();

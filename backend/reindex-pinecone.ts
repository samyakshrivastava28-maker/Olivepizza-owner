import { pineconeService } from './src/services/ai/PineconeService.js';
import { knowledgeSync } from './src/services/ai/KnowledgeSync.js';
import kb from './src/services/KnowledgeBaseService.js';
import { adminDb } from './src/config/firebase.js';

async function run() {
  try {
    console.log('Initializing Knowledge Base (Live DB)...');
    await kb.initialize();

    console.log('Wiping Pinecone...');
    await pineconeService.clearAll();

    console.log('Syncing live data to Pinecone...');
    const result = await knowledgeSync.syncAll();
    console.log('Sync Result:', result);

    process.exit(0);
  } catch (error) {
    console.error('Reindex Error:', error);
    process.exit(1);
  }
}

run();

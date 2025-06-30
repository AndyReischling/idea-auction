import { useEffect } from 'react';

export function useSearchIntegration() {
  // Auto-index when new content is created
  const indexNewOpinion = async (opinion: string, index: number) => {
    try {
      // Use absolute import path
      const { ContentIndexer } = await import('@/app/lib/contentIndexer');
      const indexer = new ContentIndexer();
      await indexer.indexNewOpinion(opinion, index);
      console.log('✅ Successfully indexed new opinion');
    } catch (error) {
      console.warn('Search indexing not available:', error);
    }
  };

  const indexNewActivity = async (activity: any) => {
    try {
      // Use absolute import path
      const { ContentIndexer } = await import('@/app/lib/contentIndexer');
      const indexer = new ContentIndexer();
      await indexer.indexNewActivity(activity);
      console.log('✅ Successfully indexed new activity');
    } catch (error) {
      console.warn('Search indexing not available:', error);
    }
  };

  // Initialize search index if it doesn't exist (only on client side)
  useEffect(() => {
    const initializeSearch = async () => {
      // Only run on client side
      if (typeof window === 'undefined') return;
      
      try {
        // Use absolute import paths
        const { EmbeddingService } = await import('@/app/lib/embeddings');
        const { ContentIndexer } = await import('@/app/lib/contentIndexer');
        
        const embeddingService = EmbeddingService.getInstance();
        
        // Only build index if it's completely empty
        if (embeddingService.getEmbeddingCount() === 0) {
          console.log('🔍 No search index found, building initial index...');
          const indexer = new ContentIndexer();
          await indexer.indexAllContent();
          console.log('✅ Search index initialization completed');
        } else {
          console.log(`📚 Search index already exists with ${embeddingService.getEmbeddingCount()} items`);
        }
      } catch (error) {
        console.warn('Search system not available:', error);
      }
    };

    // Delay initialization to avoid blocking the UI
    const timer = setTimeout(initializeSearch, 3000);
    return () => clearTimeout(timer);
  }, []);

  return {
    indexNewOpinion,
    indexNewActivity,
  };
}
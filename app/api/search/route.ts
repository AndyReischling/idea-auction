import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') as 'opinion' | 'user' | 'activity' | 'transaction' | 'all';
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
  }

  try {
    // Import here to avoid issues with localStorage on server side
    const { EmbeddingService } = await import('../../lib/embeddings');
    const embeddingService = EmbeddingService.getInstance();

    const typeFilter = type && type !== 'all' ? type : undefined;
    const results = await embeddingService.searchSimilar(query, limit, typeFilter);

    const formattedResults = results.map(result => ({
      id: result.id,
      text: result.text,
      type: result.type,
      similarity: result.similarity,
      metadata: result.metadata,
      url: result.metadata.url || '#',
      score: Math.round(result.similarity * 100),
    }));

    return NextResponse.json({
      query,
      results: formattedResults,
      total: results.length,
      indexSize: embeddingService.getEmbeddingCount(),
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ 
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const { ContentIndexer } = await import('../../lib/contentIndexer');
    const indexer = new ContentIndexer();

    switch (action) {
      case 'reindex':
        await indexer.indexAllContent();
        return NextResponse.json({ 
          success: true, 
          message: 'Content reindexed successfully' 
        });

      case 'clear':
        const { EmbeddingService } = await import('../../lib/embeddings');
        const embeddingService = EmbeddingService.getInstance();
        embeddingService.clearEmbeddings();
        return NextResponse.json({ 
          success: true, 
          message: 'Search index cleared' 
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Search management error:', error);
    return NextResponse.json({ 
      error: 'Operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type  = searchParams.get('type') as
    | 'opinion'
    | 'user'
    | 'activity'
    | 'transaction'
    | 'all';
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter required' },
      { status: 400 }
    );
  }

  try {
    // EmbeddingService now stores its vectors in Firestore, no browser fallback
    const { EmbeddingService } = await import('@/lib/embeddings');
    const embeddingService     = EmbeddingService.getInstance();

    const typeFilter =
      type && type !== 'all' ? (type as typeof typeFilter) : undefined;
    const results   = await embeddingService.searchSimilar(
      query,
      limit,
      typeFilter
    );

    const formatted = results.map(r => ({
      id:   r.id,
      text: r.text,
      type: r.type,
      url:  r.metadata.url || '#',
      score: Math.round(r.similarity * 100),
      metadata: r.metadata,
      similarity: r.similarity,
    }));

    return NextResponse.json({
      query,
      results:  formatted,
      total:    results.length,
      indexSize: embeddingService.getEmbeddingCount(),
    });
  } catch (err: any) {
    console.error('Search API error:', err);
    return NextResponse.json(
      { error: 'Search failed', details: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    const { ContentIndexer } = await import('@/lib/contentIndexer');
    const indexer = new ContentIndexer();

    switch (action) {
      case 'reindex':
        await indexer.indexAllContent();
        return NextResponse.json({
          success: true,
          message: 'Content re-indexed successfully',
        });

      case 'clear': {
        const { EmbeddingService } = await import('@/lib/embeddings');
        EmbeddingService.getInstance().clearEmbeddings();
        return NextResponse.json({
          success: true,
          message: 'Search index cleared',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error('Search management error:', err);
    return NextResponse.json(
      { error: 'Operation failed', details: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

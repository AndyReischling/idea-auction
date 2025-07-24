import React from 'react';
import { OpinionCard, OpinionCardData } from './OpinionCard';
import { Layout } from './Layout';

// ❌ HARDCODED OPINIONS ELIMINATED: Using generic placeholder data for UI examples only
const sampleOpinions: OpinionCardData[] = [
  {
    id: 'op1',
    text: '[Example Opinion Text - This is a placeholder for UI demonstration only]',
    quantity: 10,
    averagePrice: 12.50,
    currentPrice: 15.75,
    currentValue: 157.50,
    unrealizedGainLoss: 32.50,
    unrealizedGainLossPercent: 26.0,
    author: 'ExampleUser',
    volume: 245,
    isBot: false
  },
  {
    id: 'op2', 
    text: '[Example Opinion Text #2 - Placeholder for UI demonstration only]',
    quantity: 5,
    averagePrice: 8.00,
    currentPrice: 6.25,
    currentValue: 31.25,
    unrealizedGainLoss: -8.75,
    unrealizedGainLossPercent: -21.9,
    author: 'ExampleBot',
    volume: 189,
    isBot: true
  },
  {
    id: 'op3',
    text: '[Example Opinion Text #3 - Placeholder for UI demonstration only]',
    currentPrice: 22.40,
    author: 'ExampleUser',
    volume: 892,
    isBot: false
  }
];

export function OpinionCardExamples() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            OpinionCard Component Examples
          </h1>
          <p className="text-gray-600">
            Consistent opinion card components for use across all pages
          </p>
        </div>

        {/* Trading Portfolio Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Trading Portfolio Cards</h2>
          <p className="text-gray-600 mb-6">
            Use these for displaying owned opinions with trading information (quantity, P&L, etc.)
          </p>
          
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {sampleOpinions.slice(0, 2).map((opinion) => (
              <OpinionCard
                key={opinion.id}
                opinion={opinion}
                variant="default"
              />
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Usage:</h4>
            <pre className="text-xs text-gray-700 overflow-x-auto">
{`<OpinionCard
  opinion={{
    id: 'op1',
    text: 'Opinion text here...',
    quantity: 10,
    averagePrice: 12.50,
    currentPrice: 15.75,
    currentValue: 157.50,
    unrealizedGainLoss: 32.50,
    unrealizedGainLossPercent: 26.0
  }}
  variant="default"
/>`}
            </pre>
          </div>
        </section>

        {/* Compact List Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Compact List Cards</h2>
          <p className="text-gray-600 mb-6">
            Use these for opinion lists, search results, or sidebars where space is limited
          </p>
          
          <div className="space-y-3 max-w-md">
            {sampleOpinions.map((opinion) => (
              <OpinionCard
                key={`compact-${opinion.id}`}
                opinion={opinion}
                variant="compact"
              />
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Usage:</h4>
            <pre className="text-xs text-gray-700 overflow-x-auto">
{`<OpinionCard
  opinion={opinion}
  variant="compact"
/>`}
            </pre>
          </div>
        </section>

        {/* Market Display Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Market Display Cards</h2>
          <p className="text-gray-600 mb-6">
            Use these for public opinion markets where only price and basic info is shown
          </p>
          
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {sampleOpinions.map((opinion) => (
              <OpinionCard
                key={`market-${opinion.id}`}
                opinion={{
                  ...opinion,
                  // Remove trading-specific data for market display
                  quantity: undefined,
                  averagePrice: undefined,
                  currentValue: undefined,
                  unrealizedGainLoss: undefined,
                  unrealizedGainLossPercent: undefined
                }}
                variant="default"
              />
            ))}
          </div>
        </section>

        {/* Error Handling */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Error Handling</h2>
          <p className="text-gray-600 mb-6">
            The component gracefully handles missing data and logs issues to console
          </p>
          
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {/* Missing ID - won't render */}
            <div className="border border-red-200 p-4 rounded-lg">
              <h4 className="text-red-800 font-semibold mb-2">Missing ID (Won't Render)</h4>
              <OpinionCard
                opinion={{
                  text: 'This opinion has no ID',
                  currentPrice: 10.00
                }}
                variant="default"
              />
              <p className="text-red-600 text-sm mt-2">
                Check console for warning message
              </p>
            </div>
            
            {/* Missing text */}
            <div className="border border-yellow-200 p-4 rounded-lg">
              <h4 className="text-yellow-800 font-semibold mb-2">Missing Text</h4>
              <OpinionCard
                opinion={{
                  id: 'no-text',
                  text: '',
                  currentPrice: 10.00
                }}
                variant="default"
              />
              <p className="text-yellow-600 text-sm mt-2">
                Shows "Opinion text not available" placeholder
              </p>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Best Practices</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>Always provide a unique `id` for each opinion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>Use `variant="compact"` for lists and sidebars</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>Use `variant="default"` for main content areas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>Include trading data only for portfolio/profile pages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>Use OpinionDataDebugger during development to catch data issues</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span>Handle click events with the `onClick` prop if custom routing is needed</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </Layout>
  );
} 
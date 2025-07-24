/**
 * Example Page - Shows how to use consistent UI elements
 * Use this as a template for creating new pages
 */

'use client';

import React, { useState } from 'react';
import { 
  Layout, 
  PageContainer, 
  Section,
  Card, 
  CardHeader, 
  CardTitle, 
  CardSubtitle, 
  CardContent, 
  CardFooter,
  Button, 
  Grid, 
  Badge,
  Icon,
  EmptyState,
  LoadingState,
  ErrorState 
} from './index';

export const ExamplePage: React.FC = () => {
  const [currentView, setCurrentView] = useState<'content' | 'loading' | 'empty' | 'error'>('content');

  return (
    <Layout
      header={{
        title: "Example Page",
        showSearch: true,
        currentPage: 'other'
      }}
      maxWidth="xl"
    >
      <PageContainer
        title="Consistent UI Elements"
        subtitle="Examples of how to use the design system components"
      >
        
        {/* State Toggle Section */}
        <Section 
          title="Page States" 
          subtitle="Toggle between different page states"
        >
          <div className="flex gap-3">
            <Button 
              variant={currentView === 'content' ? 'primary' : 'ghost'}
              onClick={() => setCurrentView('content')}
            >
              Content
            </Button>
            <Button 
              variant={currentView === 'loading' ? 'primary' : 'ghost'}
              onClick={() => setCurrentView('loading')}
            >
              Loading
            </Button>
            <Button 
              variant={currentView === 'empty' ? 'primary' : 'ghost'}
              onClick={() => setCurrentView('empty')}
            >
              Empty
            </Button>
            <Button 
              variant={currentView === 'error' ? 'primary' : 'ghost'}
              onClick={() => setCurrentView('error')}
            >
              Error
            </Button>
          </div>
        </Section>

        {/* Dynamic Content Based on State */}
        {currentView === 'loading' && (
          <LoadingState message="Loading your opinions..." />
        )}

        {currentView === 'empty' && (
          <EmptyState
            icon="empty"
            title="No Opinions Found"
            description="You haven't created any opinions yet. Start by generating your first opinion!"
            action={{
              label: "Generate Opinion",
              onClick: () => alert('Redirect to generate page'),
              variant: 'primary',
              icon: 'generate'
            }}
          />
        )}

        {currentView === 'error' && (
          <ErrorState
            title="Failed to Load Opinions"
            message="We couldn't load your opinions. Please check your connection and try again."
            onRetry={() => alert('Retrying...')}
          />
        )}

        {currentView === 'content' && (
          <>
            {/* Cards Grid Section */}
            <Section 
              title="Opinion Cards" 
              subtitle="Examples of consistent card layouts"
              spacing="lg"
            >
              <Grid columns="auto-fit-3" gap="lg">
                
                {/* Example Opinion Card */}
                <Card interactive>
                  <CardHeader>
                    <div className="flex-1">
                      <CardTitle>AI will transform healthcare by 2030</CardTitle>
                      <CardSubtitle>by @healthexpert • 2 hours ago</CardSubtitle>
                    </div>
                    <Badge variant="trending" icon="trending">Hot</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold font-number">$24.56</div>
                      <div className="flex items-center gap-1 text-emerald-green">
                        <Icon name="trendUp" size="sm" />
                        <span className="text-sm font-medium">+12.4%</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" iconBefore="buy">Buy</Button>
                      <Button size="sm" variant="danger" iconBefore="sell">Sell</Button>
                      <Button size="sm" variant="ghost" iconOnly="share" />
                    </div>
                  </CardFooter>
                </Card>

                {/* Example User Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-soft-purple rounded-full flex items-center justify-center">
                        <Icon name="user" size="lg" className="text-accent-purple" />
                      </div>
                      <div className="flex-1">
                        <CardTitle>@cryptotrader</CardTitle>
                        <CardSubtitle>Portfolio: $3,456.78</CardSubtitle>
                      </div>
                      <Badge variant="success" icon="trophy">Top 5%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-green">+23.5%</div>
                        <div className="text-xs text-text-tertiary">All Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">89</div>
                        <div className="text-xs text-text-tertiary">Trades</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">92%</div>
                        <div className="text-xs text-text-tertiary">Win Rate</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Example Stats Card */}
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>Market Overview</CardTitle>
                    <Icon name="chartUp" size="lg" className="text-emerald-green" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Active Opinions:</span>
                        <span className="font-bold">1,247</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Total Volume:</span>
                        <span className="font-bold">$127,450</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Active Traders:</span>
                        <span className="font-bold">342</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button fullWidth variant="secondary" iconBefore="view">
                      View Details
                    </Button>
                  </CardFooter>
                </Card>

              </Grid>
            </Section>

            {/* Buttons Section */}
            <Section title="Action Buttons" subtitle="Consistent button styles">
              <div className="space-y-4">
                
                {/* Primary Actions */}
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" iconBefore="generate">Generate Opinion</Button>
                  <Button variant="primary" iconBefore="buy">Buy Position</Button>
                  <Button variant="danger" iconBefore="sell">Sell Position</Button>
                  <Button variant="secondary" iconBefore="bet">Place Bet</Button>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-wrap gap-3">
                  <Button variant="ghost" iconBefore="view">View Details</Button>
                  <Button variant="ghost" iconBefore="share">Share</Button>
                  <Button variant="ghost" iconOnly="favorite" />
                  <Button variant="ghost" iconOnly="bookmark" />
                </div>

                {/* States */}
                <div className="flex flex-wrap gap-3">
                  <Button loading>Processing...</Button>
                  <Button disabled>Disabled</Button>
                  <Button variant="primary" size="sm">Small</Button>
                  <Button variant="primary" size="lg">Large</Button>
                </div>

              </div>
            </Section>

            {/* Status Indicators */}
            <Section title="Status & Badges" subtitle="Consistent status indicators">
              <div className="space-y-4">
                
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success" icon="success">Active</Badge>
                  <Badge variant="warning" icon="warning">Pending</Badge>
                  <Badge variant="error" icon="error">Failed</Badge>
                  <Badge variant="info" icon="info">Info</Badge>
                  <Badge variant="trending" icon="trending">Trending</Badge>
                  <Badge variant="neutral">Neutral</Badge>
                </div>

                {/* User Type Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info" icon="user">Human</Badge>
                  <Badge variant="info" icon="bot">Bot</Badge>
                  <Badge variant="success" icon="ai">AI Generated</Badge>
                  <Badge variant="warning" icon="trophy">Top Trader</Badge>
                </div>

                {/* Market Status */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Icon name="trendUp" size="md" className="text-emerald-green" />
                    <span className="text-emerald-green font-bold">+15.2%</span>
                    <Badge variant="success" size="sm">Rising</Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Icon name="trendDown" size="md" className="text-coral-red" />
                    <span className="text-coral-red font-bold">-8.5%</span>
                    <Badge variant="error" size="sm">Falling</Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Icon name="remove" size="md" className="text-text-secondary" />
                    <span className="text-text-secondary font-bold">0.0%</span>
                    <Badge variant="neutral" size="sm">Stable</Badge>
                  </div>
                </div>

              </div>
            </Section>

          </>
        )}

      </PageContainer>
    </Layout>
  );
};

export default ExamplePage; 
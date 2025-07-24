/**
 * Design System Demo - Examples of all UI components
 * This component demonstrates how to use the design system components
 */

import React from 'react';
import { Button, Card, CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter, Grid, Badge, Icon } from './index';

export const DesignSystemDemo: React.FC = () => {
  return (
    <div className="p-8 bg-bg-white min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-text-primary">Design System Demo</h1>
          <p className="text-lg text-text-secondary">Consistent UI components built with Tailwind CSS</p>
        </div>

        {/* Buttons Section */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardSubtitle>Various button styles and configurations</CardSubtitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Button variants */}
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="danger">Danger Button</Button>
                <Button variant="ghost">Ghost Button</Button>
              </div>

              {/* Buttons with icons */}
              <div className="flex flex-wrap gap-3">
                <Button iconBefore="buy" variant="primary">Buy Opinion</Button>
                <Button iconBefore="sell" variant="danger">Sell Opinion</Button>
                <Button iconOnly="search" variant="ghost" />
                <Button iconAfter="arrowRight" variant="secondary">Continue</Button>
              </div>

              {/* Button sizes */}
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small Button</Button>
                <Button size="md">Medium Button</Button>
                <Button size="lg">Large Button</Button>
              </div>

              {/* Button states */}
              <div className="flex flex-wrap gap-3">
                <Button loading>Loading...</Button>
                <Button disabled>Disabled</Button>
                <Button fullWidth>Full Width Button</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Cards</h2>
          <Grid columns="auto-fit-3" gap="lg">
            
            {/* Default Card */}
            <Card>
              <CardHeader>
                <CardTitle>Default Card</CardTitle>
                <Icon name="trendUp" size="lg" className="text-emerald-green" />
              </CardHeader>
              <CardContent>
                <p className="text-text-secondary">This is a default card with standard styling and hover effects.</p>
              </CardContent>
              <CardFooter>
                <Badge variant="success" icon="success">Active</Badge>
              </CardFooter>
            </Card>

            {/* Elevated Card */}
            <Card variant="elevated" interactive>
              <CardHeader>
                <CardTitle>Interactive Card</CardTitle>
                <Badge variant="trending" icon="trending">Hot</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-text-secondary">This card is interactive and clickable with elevated shadow.</p>
              </CardContent>
            </Card>

            {/* Outline Card */}
            <Card variant="outline" hoverable={false}>
              <CardHeader>
                <CardTitle>Outline Card</CardTitle>
                <Icon name="chartDown" size="lg" className="text-coral-red" />
              </CardHeader>
              <CardContent>
                <p className="text-text-secondary">This card uses outline style without hover effects.</p>
              </CardContent>
              <CardFooter>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary">Action</Button>
                  <Button size="sm" variant="ghost">Cancel</Button>
                </div>
              </CardFooter>
            </Card>

          </Grid>
        </div>

        {/* Badges Section */}
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardSubtitle>Status indicators and labels</CardSubtitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              
              {/* Badge variants */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Success</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="neutral">Neutral</Badge>
                <Badge variant="trending">Trending</Badge>
              </div>

              {/* Badges with icons */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" icon="success">Verified</Badge>
                <Badge variant="error" icon="error">Failed</Badge>
                <Badge variant="warning" icon="warning">Alert</Badge>
                <Badge variant="info" icon="info">Notice</Badge>
              </div>

              {/* Badge sizes */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="sm">Small</Badge>
                <Badge size="md">Medium</Badge>
                <Badge size="lg">Large</Badge>
              </div>

              {/* Badges with dots */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" dot>Online</Badge>
                <Badge variant="error" dot>Offline</Badge>
                <Badge variant="warning" dot>Pending</Badge>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Icons Section */}
        <Card>
          <CardHeader>
            <CardTitle>Icons</CardTitle>
            <CardSubtitle>Phosphor Icons integration with consistent sizing</CardSubtitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              
              {/* Icon sizes */}
              <div className="flex flex-wrap items-center gap-4">
                <Icon name="user" size="xs" />
                <Icon name="user" size="sm" />
                <Icon name="user" size="md" />
                <Icon name="user" size="lg" />
                <Icon name="user" size="xl" />
                <Icon name="user" size="xxl" />
              </div>

              {/* Semantic icons */}
              <div className="flex flex-wrap gap-4">
                <Icon name="buy" size="lg" className="text-emerald-green" />
                <Icon name="sell" size="lg" className="text-coral-red" />
                <Icon name="bot" size="lg" className="text-accent-purple" />
                <Icon name="ai" size="lg" className="text-soft-azure" />
                <Icon name="trending" size="lg" className="text-yellow" />
              </div>

              {/* Navigation icons */}
              <div className="flex flex-wrap gap-4">
                <Icon name="home" size="lg" />
                <Icon name="feed" size="lg" />
                <Icon name="generate" size="lg" />
                <Icon name="opinion" size="lg" />
                <Icon name="admin" size="lg" />
                <Icon name="search" size="lg" />
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Grid System */}
        <Card>
          <CardHeader>
            <CardTitle>Grid System</CardTitle>
            <CardSubtitle>Responsive grid layouts</CardSubtitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              
              {/* Auto-fit grids */}
              <div>
                <h4 className="text-sm font-semibold text-text-secondary mb-2">Auto-fit 4 columns</h4>
                <Grid columns="auto-fit-4" gap="md">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="bg-bg-section p-4 rounded-sm text-center text-sm">
                      Item {i}
                    </div>
                  ))}
                </Grid>
              </div>

              {/* Fixed grid */}
              <div>
                <h4 className="text-sm font-semibold text-text-secondary mb-2">Fixed 3 columns</h4>
                <Grid columns={3} gap="lg">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-bg-section p-6 rounded-sm text-center">
                      Column {i}
                    </div>
                  ))}
                </Grid>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Usage Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Examples</CardTitle>
            <CardSubtitle>Common patterns and combinations</CardSubtitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              
              {/* Opinion Card Example */}
              <div>
                <h4 className="text-sm font-semibold text-text-secondary mb-3">Opinion Card Pattern</h4>
                <Card interactive>
                  <CardHeader>
                    <div className="flex-1">
                      <CardTitle>[Example Opinion - UI Demo Only]</CardTitle>
                      <CardSubtitle>by @techexpert • 2 hours ago</CardSubtitle>
                    </div>
                    <Badge variant="trending" icon="trending">Hot</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold font-number">$12.45</div>
                      <div className="flex items-center gap-1 text-emerald-green">
                        <Icon name="trendUp" size="sm" />
                        <span className="text-sm font-medium">+5.2%</span>
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
              </div>

              {/* User Profile Example */}
              <div>
                <h4 className="text-sm font-semibold text-text-secondary mb-3">User Profile Pattern</h4>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-soft-purple rounded-full flex items-center justify-center">
                        <Icon name="user" size="lg" className="text-accent-purple" />
                      </div>
                      <div className="flex-1">
                        <CardTitle>@cryptotrader</CardTitle>
                        <CardSubtitle>Portfolio: $1,234.56 • 23 opinions</CardSubtitle>
                      </div>
                      <Badge variant="success" icon="trophy">Top 10%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-green">+15.2%</div>
                        <div className="text-xs text-text-tertiary">All Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">127</div>
                        <div className="text-xs text-text-tertiary">Bets</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">89%</div>
                        <div className="text-xs text-text-tertiary">Win Rate</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default DesignSystemDemo; 
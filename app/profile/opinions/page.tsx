// =============================================================================
// app/profile/opinions/page.tsx – Complete log of all owned opinions
// =============================================================================

'use client';


import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { realtimeDataService } from '../../lib/realtime-data-service';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getUserPortfolio, migrateUserPortfolio, type Portfolio } from '../../lib/portfolio-utils';
import Sidebar from '../../components/Sidebar';
import AuthGuard from '../../components/AuthGuard';
import AuthButton from '../../components/AuthButton';
import AuthStatusIndicator from '../../components/AuthStatusIndicator';
import { ArrowLeft, ScanSmiley, RssSimple, Balloon } from '@phosphor-icons/react';

// Data interfaces
interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
}

interface OpinionAsset {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  quantity: number;
}

export default function OpinionsLogPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    // Fetch portfolio data using new structure
    const fetchPortfolioData = async (userProfile: any) => {
      try {
        // Try to get the new portfolio structure first
        let portfolio: Portfolio;
        
        try {
          portfolio = await getUserPortfolio(user.uid);
        } catch (error) {
          console.warn('Failed to load new portfolio, trying migration...');
          await migrateUserPortfolio(user.uid);
          portfolio = await getUserPortfolio(user.uid);
        }
        
        // If no items in new portfolio but old portfolio exists, migrate
        if (portfolio.items.length === 0 && userProfile?.portfolio) {
          console.log('🔄 Migrating portfolio data...');
          await migrateUserPortfolio(user.uid);
          portfolio = await getUserPortfolio(user.uid);
        }
        
        // Get market data for current prices
        const marketData = await realtimeDataService.getMarketData();
        
        // Transform portfolio items to the expected format
        const transformedOpinions = portfolio.items.map(item => ({
          id: item.opinionId,
          text: item.opinionText,
          purchasePrice: item.averagePrice,
          currentPrice: marketData[item.opinionText]?.currentPrice || item.averagePrice,
          purchaseDate: new Date(item.lastUpdated).toLocaleDateString(),
          quantity: item.quantity,
        }));
        
        setOwnedOpinions(transformedOpinions);
      } catch (error) {
        console.error('Error fetching portfolio data:', error);
        setOwnedOpinions([]);
      }
    };

    // Get user profile and portfolio data
    const unsubProfile = realtimeDataService.subscribeToUserProfile(
      user.uid,
      (p) => {
        const userProfile = {
          username: p.username,
          balance: p.balance,
          joinDate: p.joinDate?.toDate?.()?.toISOString?.() ?? p.joinDate,
          totalEarnings: p.totalEarnings,
          totalLosses: p.totalLosses,
        };
        setProfile(userProfile);
        fetchPortfolioData(p);
      }
    );

    setLoading(false);
    return () => {
      unsubProfile && realtimeDataService.unsubscribe(unsubProfile);
    };
  }, [user?.uid]);

  if (!user) return <AuthGuard><AuthButton /></AuthGuard>;
  if (loading || !profile) return <div className="loading">Loading…</div>;

  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content">
        {/* Header */}
        <div className="header-section">
          <div className="user-header">
            <div className="user-avatar">{profile.username[0]}</div>
            <div className="user-info">
              <div className="user-name">{profile.username}</div>
              <p>All Owned Opinions</p>
            </div>
          </div>

          <div className="navigation-buttons">
            <a href="/profile" className="nav-button">
              <ArrowLeft size={20} /> Back to Profile
            </a>
            <a href="/users" className="nav-button">
              <ScanSmiley size={20} /> View Traders
            </a>
            <a href="/feed" className="nav-button">
              <RssSimple size={20} /> Live Feed
            </a>
            <a href="/generate" className="nav-button">
              <Balloon size={20} /> Generate
            </a>
            <AuthStatusIndicator />
            <AuthButton />
          </div>
        </div>

        {/* Back Button */}
        <div style={{ margin: '20px 0' }}>
          <a 
            href="/profile" 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '500',
              transition: 'color var(--transition)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <ArrowLeft size={16} />
            Back to Profile
          </a>
        </div>

        {/* Opinions Log */}
        <section style={{ margin: '60px 0 20px 0' }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '16px',
          }}>
            Complete Opinions Log ({ownedOpinions.length} total)
          </h2>

          {ownedOpinions.length === 0 ? (
            <div className="empty-state">You don't own any opinions yet.</div>
          ) : (
            <div style={{ paddingLeft: '16px', paddingRight: '16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(2, 1fr)',
                gap: '20px',
                background: 'var(--white)',
              }}>
                {/* Grid items ordered by: most recent (top-left), 2nd most recent (top-middle), 3rd most recent (top-right), 4th most recent (bottom-left), 5th most recent (bottom-middle), 6th most recent (bottom-right) */}
                {ownedOpinions
                  .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
                  .slice(0, 6)
                  .map((opinion, index) => {
                    const gain = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                    const pct = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                    
                    return (
                      <a
                        key={opinion.id}
                        href={`/opinion/${opinion.id}`}
                        style={{
                          background: 'var(--white)',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                          minHeight: '200px',
                          textDecoration: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          transition: 'background var(--transition)',
                          border: '1px solid var(--border-secondary)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-light)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--white)';
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontSize: 'var(--font-size-md)',
                            fontWeight: '500',
                            margin: '0 0 8px 0',
                            color: 'var(--text-primary)',
                            lineHeight: '1.4',
                          }}>
                            {opinion.text}
                          </p>
                          <p style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary)',
                            margin: '0',
                          }}>
                            Purchased: {new Date(opinion.purchaseDate).toLocaleDateString()} | Qty: {opinion.quantity}
                          </p>
                        </div>
                        
                        <div style={{
                          borderTop: '1px solid var(--border-secondary)',
                          paddingTop: '12px',
                          marginTop: 'auto',
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            gap: '8px',
                          }}>
                            <div>
                              <p style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-secondary)',
                                margin: '0',
                              }}>
                                Bought: ${opinion.purchasePrice.toFixed(2)}
                              </p>
                              <p style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: '700',
                                margin: '4px 0 0 0',
                                color: 'var(--text-primary)',
                              }}>
                                ${opinion.currentPrice.toFixed(2)}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{
                                fontSize: 'var(--font-size-sm)',
                                margin: '0',
                                color: gain >= 0 ? 'var(--green)' : 'var(--red)',
                                fontWeight: '600',
                              }}>
                                {gain >= 0 ? '+' : ''}${gain.toFixed(2)}
                              </p>
                              <p style={{
                                fontSize: 'var(--font-size-xs)',
                                margin: '0',
                                color: pct >= 0 ? 'var(--green)' : 'var(--red)',
                              }}>
                                ({pct.toFixed(1)}%)
                              </p>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
              </div>
              
              {/* Show remaining opinions in a list below the grid if there are more than 6 */}
              {ownedOpinions.length > 6 && (
                <div style={{ marginTop: '40px' }}>
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '600',
                    margin: '0 0 20px 0',
                    color: 'var(--text-primary)',
                  }}>
                    Additional Opinions ({ownedOpinions.length - 6} more)
                  </h3>
                  <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-secondary)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                  }}>
                    {ownedOpinions
                      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
                      .slice(6)
                      .map((opinion) => {
                        const gain = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                        const pct = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                        
                        return (
                          <a
                            key={opinion.id}
                            href={`/opinion/${opinion.id}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 120px 120px 120px 120px',
                              gap: '16px',
                              padding: '16px 20px',
                              borderBottom: '1px solid var(--border-secondary)',
                              textDecoration: 'none',
                              color: 'inherit',
                              transition: 'background var(--transition)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--bg-section)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: '500',
                              color: 'var(--text-primary)',
                              lineHeight: '1.4',
                            }}>
                              {opinion.text}
                            </div>
                            
                            <div style={{
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--text-primary)',
                              fontWeight: '600',
                            }}>
                              {opinion.quantity}
                            </div>
                            
                            <div style={{
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--text-secondary)',
                            }}>
                              ${opinion.purchasePrice.toFixed(2)}
                            </div>
                            
                            <div style={{
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--text-primary)',
                              fontWeight: '600',
                            }}>
                              ${opinion.currentPrice.toFixed(2)}
                            </div>
                            
                            <div style={{
                              fontSize: 'var(--font-size-sm)',
                              color: gain >= 0 ? 'var(--green)' : 'var(--red)',
                              fontWeight: '600',
                            }}>
                              {gain >= 0 ? '+' : ''}${gain.toFixed(2)}
                              <br />
                              <span style={{
                                fontSize: 'var(--font-size-xs)',
                                opacity: 0.8,
                              }}>
                                ({pct.toFixed(1)}%)
                              </span>
                            </div>
                          </a>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
} 
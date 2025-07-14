// =============================================================================
// app/profile/opinions/page.tsx – Complete log of all owned opinions
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { realtimeDataService } from '../../lib/realtime-data-service';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
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

    // Fetch portfolio data
    const fetchPortfolioData = async (userProfile: any) => {
      if (!userProfile?.portfolio) {
        setOwnedOpinions([]);
        return;
      }

      const marketData = await realtimeDataService.getMarketData();
      
      const transformedPortfolio = await Promise.all(
        Object.entries(userProfile.portfolio).map(async ([opinionKey, portfolioData]) => {
          try {
            // Extract text and quantity from portfolio data
            // opinionKey is now the sanitized field name, we need to find the original opinion text
            let opinionText = opinionKey;
            let quantity = typeof portfolioData === 'object' && portfolioData !== null
              ? Object.values(portfolioData)[0] as number
              : portfolioData as number;
            
            // If the key looks sanitized (contains underscores), try to find the original opinion text
            if (opinionKey.includes('_')) {
              // Query all opinions to find the one whose sanitized version matches this key
              const sanitizeFieldName = (text: string): string => {
                return text.replace(/[.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 100);
              };
              
              const allOpinionsSnap = await getDocs(collection(db, 'opinions'));
              const matchingOpinion = allOpinionsSnap.docs.find(doc => 
                sanitizeFieldName(doc.data().text) === opinionKey
              );
              
              if (matchingOpinion) {
                opinionText = matchingOpinion.data().text;
              }
            }

            const q = query(
              collection(db, 'opinions'),
              where('text', '==', opinionText),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            
            let opinionId = btoa(String(opinionText)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
            if (!querySnapshot.empty) {
              opinionId = querySnapshot.docs[0].id;
            }

            return {
              id: opinionId,
              text: String(opinionText), // Ensure it's a string
              purchasePrice: marketData[opinionText]?.basePrice || 10.00,
              currentPrice: marketData[opinionText]?.currentPrice || 10.00,
              purchaseDate: new Date().toLocaleDateString(),
              quantity: Number(quantity) || 1,
            };
          } catch (error) {
            console.error('Error fetching opinion ID for:', opinionKey, error);
            const fallbackText = typeof portfolioData === 'object' && portfolioData !== null 
              ? Object.keys(portfolioData)[0] || opinionKey 
              : opinionKey;
            const fallbackQuantity = typeof portfolioData === 'object' && portfolioData !== null
              ? Object.values(portfolioData)[0] as number
              : portfolioData as number;
            
            return {
              id: btoa(String(fallbackText)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100),
              text: String(fallbackText), // Ensure it's a string
              purchasePrice: marketData[fallbackText]?.basePrice || 10.00,
              currentPrice: marketData[fallbackText]?.currentPrice || 10.00,
              purchaseDate: new Date().toLocaleDateString(),
              quantity: Number(fallbackQuantity) || 1,
            };
          }
        })
      );
      
      setOwnedOpinions(transformedPortfolio);
    };

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
                background: 'var(--white)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-secondary)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden',
              }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 120px 120px 120px',
                gap: '16px',
                padding: '16px 20px',
                background: 'var(--bg-light)',
                borderBottom: '1px solid var(--border-secondary)',
                fontWeight: '600',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
              }}>
                <div>Opinion</div>
                <div>Shares</div>
                <div>Buy Price</div>
                <div>Current Price</div>
                <div>P&L</div>
              </div>

              {/* Table Rows */}
              {ownedOpinions.map((opinion) => {
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
        </section>
      </main>
    </div>
  );
} 
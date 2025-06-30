import { EmbeddingService } from './embeddings';

export class ContentIndexer {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = EmbeddingService.getInstance();
  }

  async indexAllContent(): Promise<void> {
    console.log('🚀 Starting comprehensive content indexing...');
    
    await Promise.all([
      this.indexOpinions(),
      this.indexUserProfiles(),
      this.indexActivityFeed(),
      this.indexTransactions(),
    ]);
    
    console.log('✅ Content indexing completed!');
  }

  async indexOpinions(): Promise<void> {
    try {
      const opinions = this.getStoredOpinions();
      const items = opinions.map((opinion, index) => ({
        id: `opinion_${index}`,
        text: opinion,
        type: 'opinion' as const,
        metadata: {
          originalIndex: index,
          url: `/opinion/${index}`,
          category: 'opinion',
          length: opinion.length,
          wordCount: opinion.split(' ').length,
        },
      }));

      await this.embeddingService.batchAddEmbeddings(items);
      console.log(`📝 Indexed ${items.length} opinions`);
    } catch (error) {
      console.error('Error indexing opinions:', error);
    }
  }

  async indexUserProfiles(): Promise<void> {
    try {
      const users = this.getAllUsers();
      const items = [];

      for (const user of users) {
        const portfolio = this.getUserPortfolio(user.username);
        const portfolioText = portfolio.map(p => p.text).join(', ');
        
        const searchText = [
          `User: ${user.username}`,
          portfolioText ? `Owns opinions: ${portfolioText}` : 'No opinions owned',
          `Portfolio value: $${portfolio.reduce((sum, p) => sum + (p.currentPrice || 0) * (p.quantity || 0), 0)}`,
          `Balance: $${user.balance || 0}`,
        ].join('. ');

        items.push({
          id: `user_${user.username}`,
          text: searchText,
          type: 'user' as const,
          metadata: {
            username: user.username,
            balance: user.balance,
            portfolioSize: portfolio.length,
            portfolioValue: portfolio.reduce((sum, p) => sum + (p.currentPrice || 0) * (p.quantity || 0), 0),
            url: `/users/${user.username}`,
          },
        });
      }

      await this.embeddingService.batchAddEmbeddings(items);
      console.log(`👥 Indexed ${items.length} user profiles`);
    } catch (error) {
      console.error('Error indexing user profiles:', error);
    }
  }

  async indexActivityFeed(): Promise<void> {
    try {
      const activities = this.getActivityFeed();
      const items = activities
        .filter(activity => activity.opinionText)
        .map(activity => {
          const activityText = [
            `${activity.username} ${activity.type}`,
            activity.opinionText,
            activity.amount ? `Amount: $${activity.amount}` : '',
            activity.price ? `Price: $${activity.price}` : '',
          ].filter(Boolean).join('. ');

          return {
            id: `activity_${activity.id}`,
            text: activityText,
            type: 'activity' as const,
            metadata: {
              userId: activity.username,
              activityType: activity.type,
              amount: activity.amount,
              price: activity.price,
              timestamp: activity.timestamp,
              isBot: activity.isBot || false,
              opinionId: activity.opinionId,
            },
          };
        });

      await this.embeddingService.batchAddEmbeddings(items);
      console.log(`📊 Indexed ${items.length} activities`);
    } catch (error) {
      console.error('Error indexing activities:', error);
    }
  }

  async indexTransactions(): Promise<void> {
    try {
      const userTransactions = this.getUserTransactions();
      const botTransactions = this.getBotTransactions();
      const allTransactions = [...userTransactions, ...botTransactions];

      const items = allTransactions
        .filter(transaction => transaction.opinionText)
        .map(transaction => {
          const transactionText = [
            `Transaction: ${transaction.type}`,
            transaction.opinionText,
            `Amount: $${transaction.amount}`,
            `Date: ${transaction.date}`,
            transaction.botId ? `Bot: ${transaction.botId}` : 'User transaction',
          ].join('. ');

          return {
            id: `transaction_${transaction.id}`,
            text: transactionText,
            type: 'transaction' as const,
            metadata: {
              transactionType: transaction.type,
              amount: transaction.amount,
              date: transaction.date,
              opinionId: transaction.opinionId,
              botId: transaction.botId,
              isBot: !!transaction.botId,
            },
          };
        });

      await this.embeddingService.batchAddEmbeddings(items);
      console.log(`💰 Indexed ${items.length} transactions`);
    } catch (error) {
      console.error('Error indexing transactions:', error);
    }
  }

  // Real-time indexing methods
  async indexNewOpinion(opinion: string, index: number): Promise<void> {
    await this.embeddingService.addEmbedding(
      `opinion_${index}`,
      opinion,
      'opinion',
      {
        originalIndex: index,
        url: `/opinion/${index}`,
        category: 'opinion',
        length: opinion.length,
        wordCount: opinion.split(' ').length,
        createdAt: new Date().toISOString(),
      }
    );
  }

  async indexNewActivity(activity: any): Promise<void> {
    if (!activity.opinionText) return;

    const activityText = [
      `${activity.username} ${activity.type}`,
      activity.opinionText,
      activity.amount ? `Amount: $${activity.amount}` : '',
      activity.price ? `Price: $${activity.price}` : '',
    ].filter(Boolean).join('. ');

    await this.embeddingService.addEmbedding(
      `activity_${activity.id}`,
      activityText,
      'activity',
      {
        userId: activity.username,
        activityType: activity.type,
        amount: activity.amount,
        price: activity.price,
        timestamp: activity.timestamp,
        isBot: activity.isBot || false,
        opinionId: activity.opinionId,
      }
    );
  }

  // Helper methods to get data from your existing system
  private getStoredOpinions(): string[] {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('opinions') || '[]').filter(Boolean);
      } catch {
        return [];
      }
    }
    return [];
  }

  private getAllUsers(): Array<{ username: string; balance: number }> {
    if (typeof window !== 'undefined') {
      try {
        // Extract unique users from transactions and activity
        const users = new Set<string>();
        const activities = JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
        const userTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        
        activities.forEach((activity: any) => {
          if (activity.username && !activity.isBot) {
            users.add(activity.username);
          }
        });
        
        userTransactions.forEach((transaction: any) => {
          if (transaction.username) {
            users.add(transaction.username);
          }
        });

        // Get current user
        const currentUser = JSON.parse(localStorage.getItem('userProfile') || '{}');
        if (currentUser.username) {
          users.add(currentUser.username);
        }

        return Array.from(users).map(username => ({
          username,
          balance: username === currentUser.username ? currentUser.balance : 10000,
        }));
      } catch {
        return [];
      }
    }
    return [];
  }

  private getUserPortfolio(username: string): any[] {
    if (typeof window !== 'undefined') {
      try {
        const ownedOpinions = JSON.parse(localStorage.getItem('ownedOpinions') || '[]');
        // For now, return current user's portfolio. In a real app, you'd have per-user storage
        return ownedOpinions;
      } catch {
        return [];
      }
    }
    return [];
  }

  private getActivityFeed(): any[] {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  }

  private getUserTransactions(): any[] {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('transactions') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  }

  private getBotTransactions(): any[] {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('botTransactions') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  }
}
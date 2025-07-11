import React from 'react';
import styles from '../page.module.css';

interface LeaderboardCardProps {
  rank: number;
  data: {
    uid: string;
    username: string;
    joinDate: string;
    portfolioValue: number;
    exposure: number;
    opinionsCount: number;
  };
  isMe: boolean;
  onClick: () => void;
}

export default function LeaderboardCard({ rank, data, isMe, onClick }: LeaderboardCardProps) {
  return (
    <div 
      className={`${styles.leaderboardCard} ${isMe ? styles.isMe : ''}`}
      onClick={onClick}
    >
      <div className={styles.rank}>#{rank}</div>
      <div className={styles.username}>{data.username}</div>
      <div className={styles.portfolioValue}>
        ${data.portfolioValue.toFixed(2)}
      </div>
      <div className={styles.opinionsCount}>
        {data.opinionsCount} opinions
      </div>
      <div className={styles.joinDate}>
        {new Date(data.joinDate).toLocaleDateString()}
      </div>
    </div>
  );
} 
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UserDetailModalProps {
  uid: string;
  onClose: () => void;
}

export default function UserDetailModal({ uid, onClose }: UserDetailModalProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          setUser({ id: uid, ...userDoc.data() });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [uid]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{user?.username || 'User'}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2">
          <p><strong>Join Date:</strong> {user?.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Balance:</strong> ${user?.balance?.toFixed(2) || '0.00'}</p>
          <p><strong>Total Earnings:</strong> ${user?.totalEarnings?.toFixed(2) || '0.00'}</p>
          <p><strong>Total Losses:</strong> ${user?.totalLosses?.toFixed(2) || '0.00'}</p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 
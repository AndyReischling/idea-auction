import React from 'react';

interface ActivityDetailModalProps {
  activity: any;
  onClose: () => void;
  currentUser: any;
  onUpdateUser: (user: any) => void;
}

export default function ActivityDetailModal({ 
  activity, 
  onClose, 
  currentUser, 
  onUpdateUser 
}: ActivityDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Activity Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2">
          <p><strong>Type:</strong> {activity.type}</p>
          <p><strong>User:</strong> {activity.username}</p>
          <p><strong>Amount:</strong> ${Math.abs(activity.amount || 0).toFixed(2)}</p>
          <p><strong>Time:</strong> {activity.relativeTime}</p>
          {activity.opinionText && (
            <p><strong>Opinion:</strong> {activity.opinionText}</p>
          )}
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
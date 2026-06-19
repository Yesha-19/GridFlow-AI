import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-console-bg">
        <div className="flex flex-col items-center">
          <ShieldAlert className="h-12 w-12 text-blue-500 animate-pulse mb-4" />
          <p className="text-gray-400 font-mono">Verifying clearance...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page, but save the location they were trying to go to
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}

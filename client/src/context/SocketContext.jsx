import { createContext, useContext, useEffect, useState } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (isAuthenticated && token) {
      const s = connectSocket(token);
      setSocket(s);

      s.on('connect', () => {
        console.log('🔌 Socket connected:', s.id);
        setConnected(true);
      });

      s.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        setConnected(false);
      });

      s.on('connect_error', (err) => {
        console.error('❌ Socket connection error:', err.message);
        setConnected(false);
      });

      return () => {
        s.off('connect');
        s.off('disconnect');
        s.off('connect_error');
        disconnectSocket();
        setConnected(false);
        setSocket(null);
      };
    }
  }, [isAuthenticated, token]);

  const value = {
    socket,
    connected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;

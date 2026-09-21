import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Input, Button } from '../ui';
import api from '../../services/api';

export function JoinMeetingModal({
  isOpen,
  onClose,
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) {
      setError('Please enter a room code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.get(`/meetings/${cleanCode}`);
      onClose();
      navigate(`/meeting/${cleanCode}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Meeting not found. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join a Meeting"
      description="Enter the meeting code or invitation link ID."
      size="sm"
    >
      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <Input
          id="join-code"
          label="Room Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. samvada-x7k9"
          required
          autoFocus
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7h10v10H7z" />
            </svg>
          }
        />

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading} disabled={!code.trim()}>
            Join Meeting
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default JoinMeetingModal;

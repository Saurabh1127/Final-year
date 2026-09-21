import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Input, Select, Button, useToast } from '../ui';
import api from '../../services/api';

const LANGUAGE_OPTIONS = [
  { value: 'eng_Latn', label: 'English' },
  { value: 'hin_Deva', label: 'Hindi (हिन्दी)' },
  { value: 'spa_Latn', label: 'Spanish (Español)' },
  { value: 'fra_Latn', label: 'French (Français)' },
  { value: 'deu_Latn', label: 'German (Deutsch)' },
  { value: 'jpn_Jpan', label: 'Japanese (日本語)' },
  { value: 'mar_Deva', label: 'Marathi (मराठी)' },
  { value: 'tam_Taml', label: 'Tamil (தமிழ்)' },
  { value: 'ben_Beng', label: 'Bengali (বাংলা)' },
];

export function CreateMeetingModal({
  isOpen,
  onClose,
  defaultTitle = '',
}) {
  const [title, setTitle] = useState(defaultTitle || 'My Meeting');
  const [meetingType, setMeetingType] = useState('video-audio');
  const [spokenLang, setSpokenLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('eng_Latn');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/meetings', { title: title.trim() });
      const { roomCode } = res.data;
      toast.success('Meeting created! Launching room...');
      onClose();
      navigate(`/meeting/${roomCode}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create meeting.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start a New Meeting"
      description="Configure real-time translation settings for your video call."
      size="md"
    >
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <Input
          id="meeting-title"
          label="Meeting Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sprint Planning, Project Sync"
          required
          autoFocus
        />

        <Select
          id="meeting-type"
          label="Meeting Mode"
          value={meetingType}
          onChange={(e) => setMeetingType(e.target.value)}
          options={[
            { value: 'video-audio', label: 'Video & Audio (Full-Mesh WebRTC)' },
            { value: 'audio-only', label: 'Audio Only (Low Bandwidth)' },
            { value: 'transcript-only', label: 'Transcription & Dual Subtitles' },
          ]}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Select
            id="spoken-lang"
            label="My Spoken Language"
            value={spokenLang}
            onChange={(e) => setSpokenLang(e.target.value)}
            options={[
              { value: 'auto', label: 'Auto-detect' },
              ...LANGUAGE_OPTIONS,
            ]}
          />

          <Select
            id="target-lang"
            label="Target Audio Translation"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            options={LANGUAGE_OPTIONS}
          />
        </div>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            Create & Join
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateMeetingModal;

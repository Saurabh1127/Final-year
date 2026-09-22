import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import useMeetingSocket from '../../hooks/useMeetingSocket';
import useMeetingTranslation from '../../hooks/useMeetingTranslation';
import ParticipantGrid from './ParticipantGrid';
import MeetingHeader from './MeetingHeader';
import MeetingToolbar from './MeetingToolbar';
import SubtitleOverlay from './SubtitleOverlay';
import TranslationStatus from './TranslationStatus';
import RightPanel from './RightPanel';
import LeaveModal from './LeaveModal';
import PreJoinScreen from './PreJoinScreen';
import PipelineInspectorModal from './PipelineInspectorModal';
import '../../pages/Meeting.css';

/**
 * MeetingRoom
 * Core real-time multilingual video conference orchestrator.
 * Decomposed into modular components: MeetingHeader, ParticipantGrid,
 * SubtitleOverlay, TranslationStatus, MeetingToolbar, TranscriptSidebar,
 * LeaveModal, and PipelineInspectorModal.
 */
export function MeetingRoom({ roomCode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [hasJoinedLobby, setHasJoinedLobby] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || 'Guest');
  const [isEchoTestActive, setIsEchoTestActive] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState(user?.preferredLanguage || 'hi');
  const [sourceLanguage, setSourceLanguage] = useState('auto');

  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimeout = useRef(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState('transcript');
  const echoAudioRef = useRef(null);
  const remoteVideoRefs = useRef([]);

  // Hardware capture & WebRTC
  const { localStream, startCapture, stopCapture, isMuted, toggleMute, isVideoOff, toggleVideo, error: mediaError } = useAudioCapture();
  const { remoteStreams, removePeerConnection } = useWebRTC(hasJoinedLobby ? localStream : null, user?.id);

  useEffect(() => {
    startCapture(true);
    return () => {
      stopCapture();
      clearTimeout(copyToastTimeout.current);
    };
  }, [startCapture, stopCapture]);

  // Meeting Socket Lifecycle & Event Synchronization
  const { meeting, participants, error, handleRename, handleLanguageChange, handleEndMeetingForAll } = useMeetingSocket({
    socket,
    connected,
    roomCode,
    user,
    displayName,
    targetLanguage,
    isMuted,
    isVideoOff,
    hasJoinedLobby,
    localStream,
    removePeerConnection,
    stopCapture,
    navigate,
  });

  // AI Speech Translation & Receiving Pipeline
  const {
    translationEnabled,
    setTranslationEnabled,
    isTranslating,
    isPending,
    isReceiving,
    subtitle,
    translatingFor,
    transcriptLog,
    showTranscript,
    setShowTranscript,
    showDiagnosticsModal,
    setShowDiagnosticsModal,
    selectedDiagnostics,
    setSelectedDiagnostics,
    latestDiagnostics,
  } = useMeetingTranslation({
    socket,
    roomCode,
    user,
    displayName,
    localStream,
    hasJoinedLobby,
    isMuted,
    sourceLanguage,
    remoteVideoRefs,
  });

  const isHost = Boolean(
    meeting && user && (
      (meeting.hostId?._id ? meeting.hostId._id.toString() : meeting.hostId?.toString()) === user?.id?.toString()
    )
  );

  // Echo test audio stream attachment
  useEffect(() => {
    if (echoAudioRef.current && localStream && isEchoTestActive) {
      echoAudioRef.current.srcObject = localStream;
    } else if (echoAudioRef.current) {
      echoAudioRef.current.srcObject = null;
    }
  }, [localStream, isEchoTestActive]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${roomCode}`);
    setCopyToast(true);
    clearTimeout(copyToastTimeout.current);
    copyToastTimeout.current = setTimeout(() => setCopyToast(false), 2000);
  };

  const onLanguageChange = (newLang) => {
    setTargetLanguage(newLang);
    handleLanguageChange(newLang);
    try {
      localStorage.setItem('samvada_target_lang', newLang);
    } catch (_) {}
  };

  const onRename = (newName) => {
    setDisplayName(newName);
    handleRename(newName);
  };

  const onLeaveConfirm = () => {
    setShowLeaveModal(false);
    stopCapture();
    navigate(`/summary/${roomCode}`);
  };

  const onEndMeetingForAll = () => {
    setShowLeaveModal(false);
    handleEndMeetingForAll();
    stopCapture();
    navigate(`/summary/${roomCode}`);
  };

  // ── Keyboard Shortcuts for Meeting Controls (Phase 14 Accessibility) ──
  useEffect(() => {
    if (!hasJoinedLobby) return;

    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input or textarea
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) {
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;

      // Cmd/Ctrl + D: Toggle Microphone
      if (isModifier && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        toggleMute();
      }

      // Cmd/Ctrl + E: Toggle Camera Video
      if (isModifier && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        toggleVideo();
      }

      // Cmd/Ctrl + T: Toggle AI Translation
      if (isModifier && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setTranslationEnabled((prev) => !prev);
      }

      // Cmd/Ctrl + K: Toggle Transcript Drawer
      if (isModifier && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowTranscript((prev) => !prev);
      }

      // Cmd/Ctrl + P: Toggle Participants Panel
      if (isModifier && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShowTranscript((prev) => {
          if (prev && rightPanelTab === 'participants') {
            return false;
          }
          setRightPanelTab('participants');
          return true;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasJoinedLobby, toggleMute, toggleVideo, setTranslationEnabled, setShowTranscript, rightPanelTab]);

  if (error || mediaError) {
    return (
      <div className="sam-meeting-error">
        <div className="alert alert-error">{error || mediaError}</div>
        <button className="btn btn-primary" onClick={() => { stopCapture(); navigate('/'); }}>Return to Home</button>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="sam-meeting-loading">
        <div className="spinner" />
        <p>Connecting to secure room...</p>
      </div>
    );
  }

  if (!hasJoinedLobby) {
    return (
      <PreJoinScreen
        roomCode={roomCode}
        userName={displayName}
        localStream={localStream}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        toggleMute={toggleMute}
        toggleVideo={toggleVideo}
        onJoin={() => setHasJoinedLobby(true)}
        sourceLanguage={sourceLanguage}
        setSourceLanguage={setSourceLanguage}
        targetLanguage={targetLanguage}
        setTargetLanguage={setTargetLanguage}
      />
    );
  }

  const localParticipant = {
    userId: user.id,
    displayName,
    targetLanguage: targetLanguage || 'hi',
    isMuted,
    isVideoOff,
  };

  return (
    <div className="sam-meeting-room">
      <MeetingHeader
        meetingTitle={meeting.title}
        roomCode={roomCode}
        participantCount={1 + participants.length}
        connected={connected}
        copyToast={copyToast}
        onCopyLink={handleCopyLink}
        sourceLanguage={sourceLanguage}
        setSourceLanguage={setSourceLanguage}
        targetLanguage={targetLanguage}
        onLanguageChange={onLanguageChange}
        translationEnabled={translationEnabled}
        setTranslationEnabled={setTranslationEnabled}
        isTranslating={isTranslating}
        isPending={isPending}
        isReceiving={isReceiving}
        showTranscript={showTranscript && rightPanelTab === 'transcript'}
        setShowTranscript={(val) => {
          if (typeof val === 'function') {
            setShowTranscript((prev) => {
              const next = val(prev);
              if (next) setRightPanelTab('transcript');
              return next;
            });
          } else {
            if (val) setRightPanelTab('transcript');
            setShowTranscript(val);
          }
        }}
        onOpenParticipants={() => {
          if (showTranscript && rightPanelTab === 'participants') {
            setShowTranscript(false);
          } else {
            setRightPanelTab('participants');
            setShowTranscript(true);
          }
        }}
        transcriptCount={transcriptLog.length}
        onOpenDiagnostics={() => {
          setSelectedDiagnostics(latestDiagnostics || {
            speakerName: displayName,
            originalText: 'No utterances analyzed yet.',
            diagnostics: { status: 'healthy', warnings: [] },
          });
          setShowDiagnosticsModal(true);
        }}
      />

      <main className="sam-meeting-body">
        <ParticipantGrid
          participants={participants}
          remoteStreams={remoteStreams}
          localParticipant={localParticipant}
          localStream={localStream}
          onRename={onRename}
          sourceLanguage={sourceLanguage}
        />

        <RightPanel
          isOpen={showTranscript}
          onClose={() => setShowTranscript(false)}
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          transcriptLog={transcriptLog}
          targetLanguage={targetLanguage}
          onInspectDiagnostics={(entry) => {
            setSelectedDiagnostics(entry);
            setShowDiagnosticsModal(true);
          }}
          participants={participants}
          localParticipant={localParticipant}
          sourceLanguage={sourceLanguage}
          roomCode={roomCode}
          onCopyLink={handleCopyLink}
        />
      </main>

      <TranslationStatus translatingFor={translatingFor} />

      <SubtitleOverlay
        subtitle={subtitle}
        onInspectDiagnostics={(sub) => {
          setSelectedDiagnostics(sub);
          setShowDiagnosticsModal(true);
        }}
      />

      {isEchoTestActive && <audio ref={echoAudioRef} autoPlay playsInline />}

      <MeetingToolbar
        isMuted={isMuted}
        toggleMute={toggleMute}
        isVideoOff={isVideoOff}
        toggleVideo={toggleVideo}
        isEchoTestActive={isEchoTestActive}
        toggleEchoTest={() => setIsEchoTestActive((prev) => !prev)}
        translationEnabled={translationEnabled}
        toggleTranslation={() => setTranslationEnabled((prev) => !prev)}
        showTranscript={showTranscript && rightPanelTab === 'transcript'}
        toggleTranscript={() => {
          if (showTranscript && rightPanelTab === 'transcript') {
            setShowTranscript(false);
          } else {
            setRightPanelTab('transcript');
            setShowTranscript(true);
          }
        }}
        showParticipants={showTranscript && rightPanelTab === 'participants'}
        toggleParticipants={() => {
          if (showTranscript && rightPanelTab === 'participants') {
            setShowTranscript(false);
          } else {
            setRightPanelTab('participants');
            setShowTranscript(true);
          }
        }}
        showChat={showTranscript && rightPanelTab === 'chat'}
        toggleChat={() => {
          if (showTranscript && rightPanelTab === 'chat') {
            setShowTranscript(false);
          } else {
            setRightPanelTab('chat');
            setShowTranscript(true);
          }
        }}
        onLeave={() => setShowLeaveModal(true)}
        isHost={isHost}
      />

      <LeaveModal
        isOpen={showLeaveModal}
        isHost={isHost}
        onCancel={() => setShowLeaveModal(false)}
        onLeave={onLeaveConfirm}
        onEndAll={onEndMeetingForAll}
      />

      <PipelineInspectorModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
        data={selectedDiagnostics}
      />
    </div>
  );
}

export default MeetingRoom;

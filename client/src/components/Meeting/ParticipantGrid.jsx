import React from 'react';
import ParticipantTile from './ParticipantTile';

const ParticipantGrid = ({ participants = [], remoteStreams = {}, localParticipant, localStream, onRename }) => {
  // Defensive deduplication: ensure local participant is never rendered as remote,
  // and each remote participant has exactly one unique tile
  const localId = localParticipant?.userId?.toString();
  const uniqueRemoteMap = new Map();

  for (const p of participants) {
    const pid = p?.userId?.toString();
    if (pid && pid !== localId && !uniqueRemoteMap.has(pid)) {
      uniqueRemoteMap.set(pid, p);
    }
  }

  const uniqueRemoteParticipants = Array.from(uniqueRemoteMap.values());

  return (
    <div className="participant-grid">
      {localParticipant && (
        <ParticipantTile 
          key={localId || 'local-participant'}
          participant={localParticipant}
          stream={localStream}
          isLocal={true}
          onRename={onRename}
        />
      )}
      
      {uniqueRemoteParticipants.map(p => (
        <ParticipantTile 
          key={p.userId?.toString()}
          participant={p}
          stream={remoteStreams[p.userId?.toString()] || remoteStreams[p.userId]}
          isLocal={false}
        />
      ))}
    </div>
  );
};

export default ParticipantGrid;


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
  const totalCount = uniqueRemoteParticipants.length + (localParticipant ? 1 : 0);

  // Dynamic grid column calculation for optimal video tile aspect ratio
  const gridColumns = totalCount === 1 
    ? 'minmax(0, 1fr)' 
    : totalCount === 2 
    ? 'repeat(2, minmax(0, 1fr))' 
    : 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))';

  return (
    <div
      className={`flex-1 grid gap-4 items-center justify-center w-full h-full mx-auto p-2 ${
        totalCount === 1 ? 'max-w-4xl max-h-[75vh]' : 'max-w-7xl'
      }`}
      style={{ gridTemplateColumns: gridColumns }}
    >
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

import React from 'react';
import ParticipantTile from './ParticipantTile';

/**
 * ParticipantGrid
 * Responsive multi-participant video grid.
 * Dynamically scales layout from single-speaker spotlight (1)
 * to 2-way conversation (2) to 2x2 multi-mesh grid (3-4) and beyond.
 */
export function ParticipantGrid({
  participants = [],
  remoteStreams = {},
  localParticipant,
  localStream,
  onRename,
  sourceLanguage = 'auto',
}) {
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

  const gridLayoutClass =
    totalCount <= 1
      ? 'sam-participant-grid--single'
      : totalCount === 2
      ? 'sam-participant-grid--duo'
      : totalCount <= 4
      ? 'sam-participant-grid--quad'
      : 'sam-participant-grid--multi';

  return (
    <div className={`sam-participant-grid ${gridLayoutClass}`} id="participant-grid">
      {localParticipant && (
        <ParticipantTile
          key={localId || 'local-participant'}
          participant={localParticipant}
          stream={localStream}
          isLocal={true}
          onRename={onRename}
          sourceLanguage={sourceLanguage}
        />
      )}

      {uniqueRemoteParticipants.map((p) => {
        const remoteStream = remoteStreams[p.userId?.toString()] || remoteStreams[p.userId];
        return (
          <ParticipantTile
            key={p.userId?.toString()}
            participant={p}
            stream={remoteStream}
            isLocal={false}
          />
        );
      })}
    </div>
  );
}

export default ParticipantGrid;

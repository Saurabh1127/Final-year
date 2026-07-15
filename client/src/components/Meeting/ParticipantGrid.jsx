import React from 'react';
import ParticipantTile from './ParticipantTile';

const ParticipantGrid = ({ participants, remoteStreams, localParticipant, localStream }) => {
  return (
    <div className="participant-grid">
      {localParticipant && (
        <ParticipantTile 
          key={localParticipant.userId}
          participant={localParticipant}
          stream={localStream}
          isLocal={true}
        />
      )}
      
      {participants.map(p => (
        <ParticipantTile 
          key={p.userId}
          participant={p}
          stream={remoteStreams[p.userId]}
          isLocal={false}
        />
      ))}
    </div>
  );
};

export default ParticipantGrid;

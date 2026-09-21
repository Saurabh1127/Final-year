import React from 'react';
import { Modal, Button } from '../ui';

/**
 * LeaveModal
 * Confirmation modal before exiting a call.
 * Offers standard departure for participants and an additional "End for All" option for hosts.
 */
export function LeaveModal({
  isOpen,
  isHost = false,
  onCancel,
  onLeave,
  onEndAll,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={isHost ? 'Leave or End Meeting?' : 'Leave this Meeting?'}
      description={
        isHost
          ? 'You are the host. You can leave the meeting while keeping it active for others, or end it permanently for all attendees.'
          : 'You will disconnect from this video room and be redirected to your session summary.'
      }
      size="sm"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '10px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            id="btn-leave-cancel"
          >
            Cancel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onLeave}
            id="btn-leave-confirm"
          >
            Leave Meeting
          </Button>

          {isHost && (
            <Button
              variant="danger"
              size="sm"
              onClick={onEndAll}
              id="btn-end-meeting-all"
            >
              End Meeting for All
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default LeaveModal;

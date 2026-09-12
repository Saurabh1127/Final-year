import Meeting from '../models/Meeting.js';

class MeetingService {
  async createMeeting({ title, hostId, hostName, hostLanguage }) {
    let roomCode;
    let attempts = 0;
    do {
      roomCode = Meeting.generateRoomCode();
      const existing = await Meeting.findOne({ roomCode });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('Failed to generate unique room code.');
    }

    const meeting = await Meeting.create({
      roomCode,
      title: title || `${hostName}'s Meeting`,
      hostId,
      status: 'waiting',
      participants: [
        {
          userId: hostId,
          displayName: hostName,
          targetLanguage: hostLanguage || 'en',
          isActive: false,
        },
      ],
    });

    return {
      meetingId: meeting._id,
      roomCode: meeting.roomCode,
      title: meeting.title,
    };
  }

  async getMeeting(roomCode) {
    const meeting = await Meeting.findOne({
      roomCode,
      status: { $ne: 'ended' },
    });

    if (!meeting) {
      const error = new Error('Meeting not found or has ended.');
      error.status = 404;
      throw error;
    }

    const activeParticipants = meeting.getActiveParticipants();

    return {
      meetingId: meeting._id,
      roomCode: meeting.roomCode,
      title: meeting.title,
      hostId: meeting.hostId,
      status: meeting.status,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        targetLanguage: p.targetLanguage,
        isActive: p.isActive,
      })),
      participantCount: activeParticipants.length,
    };
  }

  async updateLanguage(roomCode, userId, targetLanguage) {
    const meeting = await Meeting.findOne({ roomCode });
    if (!meeting) {
      const error = new Error('Meeting not found.');
      error.status = 404;
      throw error;
    }

    const participant = meeting.participants.find(
      (p) => p.userId.toString() === userId
    );

    if (!participant) {
      const error = new Error('You are not in this meeting.');
      error.status = 403;
      throw error;
    }

    participant.targetLanguage = targetLanguage;
    await meeting.save();
    return targetLanguage;
  }

  // Socket methods
  async joinMeeting({ roomCode, userId, displayName, targetLanguage, socketId }) {
    const meetingCheck = await Meeting.findOne({ roomCode, status: { $ne: 'ended' } });
    if (!meetingCheck) {
      throw new Error('Meeting not found');
    }

    const updateResult = await Meeting.findOneAndUpdate(
      { roomCode, status: { $ne: 'ended' }, 'participants.userId': userId },
      { 
        $set: {
          'participants.$.socketId': socketId,
          'participants.$.isActive': true,
          'participants.$.displayName': displayName || undefined,
          'participants.$.targetLanguage': targetLanguage || undefined,
        }
      },
      { new: true }
    );

    let meeting;
    if (updateResult) {
      meeting = updateResult;
    } else {
      meeting = await Meeting.findOneAndUpdate(
        { roomCode, status: { $ne: 'ended' } },
        {
          $push: {
            participants: {
              userId,
              displayName,
              targetLanguage,
              socketId: socketId,
              isActive: true
            }
          }
        },
        { new: true }
      );
    }

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    return meeting;
  }

  async leaveMeeting({ roomCode, userId }) {
    const meeting = await Meeting.findOneAndUpdate(
      { roomCode, 'participants.userId': userId },
      {
        $set: {
          'participants.$.isActive': false,
          'participants.$.socketId': null,
        }
      },
      { new: true }
    );
    return meeting;
  }
}

export default new MeetingService();

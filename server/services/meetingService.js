import mongoose from 'mongoose';
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
      throw new Error('Meeting not found or has ended.');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Remove any pre-existing participant record for this user (guarantees NO duplicates)
    await Meeting.updateOne(
      { roomCode },
      { $pull: { participants: { userId: userObjectId } } }
    );

    // 2. Atomically push the clean, single active participant record and ensure status is active
    const meeting = await Meeting.findOneAndUpdate(
      { roomCode, status: { $ne: 'ended' } },
      {
        $set: { status: 'active' },
        $push: {
          participants: {
            userId: userObjectId,
            displayName,
            targetLanguage: targetLanguage || 'en',
            socketId: socketId,
            isActive: true,
            joinedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!meeting) {
      throw new Error('Meeting not found or has ended.');
    }

    return meeting;
  }

  async leaveMeeting({ roomCode, userId }) {
    const userObjectId = mongoose.isValidObjectId(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const meeting = await Meeting.findOneAndUpdate(
      { roomCode, 'participants.userId': userObjectId },
      {
        $set: {
          'participants.$.isActive': false,
          'participants.$.socketId': null,
        },
      },
      { new: true }
    );
    return meeting;
  }

  async endMeeting({ roomCode, hostId }) {
    const meeting = await Meeting.findOne({ roomCode });
    if (!meeting) {
      const error = new Error('Meeting not found.');
      error.status = 404;
      throw error;
    }

    // Verify caller is the host
    if (meeting.hostId.toString() !== hostId.toString()) {
      const error = new Error('Only the host can end the meeting.');
      error.status = 403;
      throw error;
    }

    meeting.status = 'ended';
    meeting.endedAt = new Date();
    // Mark all participants as inactive
    meeting.participants.forEach((p) => {
      p.isActive = false;
      p.socketId = null;
    });

    await meeting.save();
    return meeting;
  }
}


export default new MeetingService();

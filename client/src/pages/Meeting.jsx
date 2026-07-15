import { useParams } from 'react-router-dom';
import MeetingRoom from '../components/Meeting/MeetingRoom';
import './Meeting.css';

const Meeting = () => {
  const { roomCode } = useParams();

  return (
    <div className="meeting-page">
      <MeetingRoom roomCode={roomCode} />
    </div>
  );
};

export default Meeting;

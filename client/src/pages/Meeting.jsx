import { useParams } from 'react-router-dom';
import MeetingRoom from '../components/Meeting/MeetingRoom';

const Meeting = () => {
  const { roomCode } = useParams();

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 font-sans overflow-hidden">
      <MeetingRoom roomCode={roomCode} />
    </div>
  );
};

export default Meeting;
